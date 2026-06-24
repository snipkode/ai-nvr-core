#include <napi.h>
#include <opencv2/opencv.hpp>
#include <opencv2/dnn.hpp>
#include <fstream>
#include <sstream>
#include <thread>
#include <mutex>
#include <atomic>
#include <queue>
#include <condition_variable>
#include <chrono>

// ─── YOLO Detector ────────────────────────────────────────────────────────────

struct Detection {
    int classId;
    float confidence;
    cv::Rect bbox;
};

class YoloDetector {
public:
    bool loaded = false;

    bool load(const std::string& modelPath, const std::string& configPath,
              const std::string& namesPath, bool useCuda) {
        std::ifstream nf(namesPath);
        if (!nf.is_open()) return false;
        std::string line;
        while (std::getline(nf, line))
            if (!line.empty()) classNames.push_back(line);

        // Support both ONNX (YOLOv8/YOLO11) and Darknet cfg/weights
        if (configPath.empty() || configPath == modelPath) {
            net = cv::dnn::readNet(modelPath);
        } else {
            net = cv::dnn::readNet(modelPath, configPath);
        }

        if (useCuda) {
            net.setPreferableBackend(cv::dnn::DNN_BACKEND_CUDA);
            net.setPreferableTarget(cv::dnn::DNN_TARGET_CUDA);
        } else {
            net.setPreferableBackend(cv::dnn::DNN_BACKEND_OPENCV);
            net.setPreferableTarget(cv::dnn::DNN_TARGET_CPU);
        }

        loaded = true;
        return true;
    }

    std::vector<Detection> detect(const cv::Mat& frame, float confThresh, float nmsThresh) {
        std::vector<Detection> results;
        if (!loaded || frame.empty()) return results;

        cv::Mat blob = cv::dnn::blobFromImage(frame, 1.0/255.0, cv::Size(640, 640),
                                               cv::Scalar(), true, false);
        net.setInput(blob);

        std::vector<cv::Mat> outs;
        net.forward(outs, net.getUnconnectedOutLayersNames());

        // YOLOv8/ONNX output: [1, 84, 8400] — transpose to [8400, 84]
        // Darknet output: vector of detection matrices
        if (outs.size() == 1 && outs[0].dims == 3) {
            parseYOLOv8(outs[0], frame.size(), confThresh, nmsThresh, results);
        } else {
            parseYOLOv5(outs, frame.size(), confThresh, nmsThresh, results);
        }
        return results;
    }

    const std::string& className(int id) const {
        static const std::string unknown = "unknown";
        return (id >= 0 && id < (int)classNames.size()) ? classNames[id] : unknown;
    }

private:
    cv::dnn::Net net;
    std::vector<std::string> classNames;

    void parseYOLOv8(const cv::Mat& out, cv::Size imgSize,
                     float confThresh, float nmsThresh,
                     std::vector<Detection>& results) {
        // out shape: [1, nc+4, 8400]
        cv::Mat data = out.reshape(1, out.size[1]); // [nc+4, 8400]
        cv::transpose(data, data);                   // [8400, nc+4]

        std::vector<int> classIds;
        std::vector<float> confs;
        std::vector<cv::Rect> boxes;
        float xScale = (float)imgSize.width  / 640.0f;
        float yScale = (float)imgSize.height / 640.0f;

        for (int i = 0; i < data.rows; i++) {
            const float* row = data.ptr<float>(i);
            cv::Mat scores(1, (int)classNames.size(), CV_32F, (void*)(row + 4));
            cv::Point maxLoc;
            double maxConf;
            cv::minMaxLoc(scores, nullptr, &maxConf, nullptr, &maxLoc);
            if (maxConf < confThresh) continue;

            float cx = row[0] * xScale, cy = row[1] * yScale;
            float w  = row[2] * xScale, h  = row[3] * yScale;
            boxes.push_back(cv::Rect((int)(cx - w/2), (int)(cy - h/2), (int)w, (int)h));
            classIds.push_back(maxLoc.x);
            confs.push_back((float)maxConf);
        }

        std::vector<int> indices;
        cv::dnn::NMSBoxes(boxes, confs, confThresh, nmsThresh, indices);
        for (int idx : indices)
            results.push_back({classIds[idx], confs[idx], boxes[idx]});
    }

    void parseYOLOv5(const std::vector<cv::Mat>& outs, cv::Size imgSize,
                     float confThresh, float nmsThresh,
                     std::vector<Detection>& results) {
        std::vector<int> classIds;
        std::vector<float> confs;
        std::vector<cv::Rect> boxes;
        float xScale = (float)imgSize.width  / 640.0f;
        float yScale = (float)imgSize.height / 640.0f;

        for (const auto& out : outs) {
            const float* data = (const float*)out.data;
            for (int i = 0; i < out.rows; i++, data += out.cols) {
                float objConf = data[4];
                if (objConf < confThresh) continue;
                cv::Mat scores(1, out.cols - 5, CV_32F, (void*)(data + 5));
                cv::Point maxLoc;
                double maxConf;
                cv::minMaxLoc(scores, nullptr, &maxConf, nullptr, &maxLoc);
                float conf = objConf * (float)maxConf;
                if (conf < confThresh) continue;

                float cx = data[0] * xScale, cy = data[1] * yScale;
                float w  = data[2] * xScale, h  = data[3] * yScale;
                boxes.push_back(cv::Rect((int)(cx - w/2), (int)(cy - h/2), (int)w, (int)h));
                classIds.push_back(maxLoc.x);
                confs.push_back(conf);
            }
        }

        std::vector<int> indices;
        cv::dnn::NMSBoxes(boxes, confs, confThresh, nmsThresh, indices);
        for (int idx : indices)
            results.push_back({classIds[idx], confs[idx], boxes[idx]});
    }
};

// ─── Frame Queue ──────────────────────────────────────────────────────────────

struct Frame {
    cv::Mat mat;
    std::string cameraId;
    int64_t timestamp;
};

class FrameQueue {
public:
    explicit FrameQueue(size_t maxSize) : maxSize_(maxSize) {}

    bool push(Frame f) {
        std::unique_lock<std::mutex> lock(mu_);
        if (queue_.size() >= maxSize_) queue_.pop(); // drop oldest
        queue_.push(std::move(f));
        cv_.notify_one();
        return true;
    }

    bool pop(Frame& f, int timeoutMs = 100) {
        std::unique_lock<std::mutex> lock(mu_);
        if (!cv_.wait_for(lock, std::chrono::milliseconds(timeoutMs),
                          [this]{ return !queue_.empty() || stopped_; }))
            return false;
        if (stopped_ && queue_.empty()) return false;
        f = std::move(queue_.front());
        queue_.pop();
        return true;
    }

    void stop() {
        std::lock_guard<std::mutex> lock(mu_);
        stopped_ = true;
        cv_.notify_all();
    }

private:
    std::queue<Frame> queue_;
    std::mutex mu_;
    std::condition_variable cv_;
    size_t maxSize_;
    bool stopped_ = false;
};

// ─── Camera Capture ───────────────────────────────────────────────────────────

struct CameraConfig {
    std::string id;
    std::string url;
    int reconnectDelaySec = 3;
};

class CameraCapture {
public:
    CameraCapture(CameraConfig cfg, FrameQueue& queue)
        : cfg_(std::move(cfg)), queue_(queue) {}

    void start() {
        running_ = true;
        thread_ = std::thread(&CameraCapture::loop, this);
    }

    void stop() {
        running_ = false;
        if (thread_.joinable()) thread_.join();
    }

private:
    void loop() {
        while (running_) {
            cv::VideoCapture cap;
            // Set RTSP transport to TCP for stability
            cap.set(cv::CAP_PROP_FOURCC, cv::VideoWriter::fourcc('M','J','P','G'));
            if (!cap.open(cfg_.url, cv::CAP_FFMPEG)) {
                std::this_thread::sleep_for(std::chrono::seconds(cfg_.reconnectDelaySec));
                continue;
            }
            while (running_) {
                cv::Mat frame;
                if (!cap.read(frame) || frame.empty()) break;
                auto ts = std::chrono::duration_cast<std::chrono::milliseconds>(
                    std::chrono::system_clock::now().time_since_epoch()).count();
                queue_.push({std::move(frame), cfg_.id, ts});
            }
            cap.release();
            if (running_)
                std::this_thread::sleep_for(std::chrono::seconds(cfg_.reconnectDelaySec));
        }
    }

    CameraConfig cfg_;
    FrameQueue& queue_;
    std::thread thread_;
    std::atomic<bool> running_{false};
};

// ─── JSON helpers (no external deps) ─────────────────────────────────────────

static std::string escapeJson(const std::string& s) {
    std::string out;
    for (char c : s) {
        if (c == '"') out += "\\\"";
        else if (c == '\\') out += "\\\\";
        else out += c;
    }
    return out;
}

static std::string detectionsToJson(const std::string& camId, int64_t ts,
                                    const std::vector<Detection>& dets,
                                    const YoloDetector& detector) {
    std::ostringstream ss;
    ss << "{\"camera_id\":\"" << escapeJson(camId) << "\","
       << "\"timestamp\":" << ts << ","
       << "\"objects\":[";
    for (size_t i = 0; i < dets.size(); i++) {
        const auto& d = dets[i];
        if (i) ss << ",";
        ss << "{\"class\":\"" << escapeJson(detector.className(d.classId)) << "\","
           << "\"confidence\":" << std::fixed << std::setprecision(4) << d.confidence << ","
           << "\"bbox\":[" << d.bbox.x << "," << d.bbox.y << ","
           << d.bbox.width << "," << d.bbox.height << "]}";
    }
    ss << "]}";
    return ss.str();
}

// ─── N-API exports ────────────────────────────────────────────────────────────

// Global shared state (one detector, one queue per process)
static YoloDetector g_detector;
static std::unique_ptr<FrameQueue> g_queue;
static std::vector<std::unique_ptr<CameraCapture>> g_cameras;
static std::atomic<bool> g_workerRunning{false};
static std::thread g_workerThread;
static Napi::ThreadSafeFunction g_tsfn;

// loadModel(modelPath, configPath, namesPath, useCuda) → bool
Napi::Value LoadModel(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    if (info.Length() < 3)
        return Napi::Boolean::New(env, false);
    std::string model  = info[0].As<Napi::String>();
    std::string config = info[1].As<Napi::String>();
    std::string names  = info[2].As<Napi::String>();
    bool cuda = info.Length() > 3 && info[3].As<Napi::Boolean>().Value();
    return Napi::Boolean::New(env, g_detector.load(model, config, names, cuda));
}

// detectFrame(jpegBuffer, cameraId) → JSON string
Napi::Value DetectFrame(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    if (info.Length() < 2 || !g_detector.loaded)
        return env.Null();

    auto buf = info[0].As<Napi::Buffer<uint8_t>>();
    std::string camId = info[1].As<Napi::String>();
    std::vector<uint8_t> data(buf.Data(), buf.Data() + buf.Length());
    cv::Mat frame = cv::imdecode(data, cv::IMREAD_COLOR);
    if (frame.empty()) return env.Null();

    auto dets = g_detector.detect(frame, 0.5f, 0.45f);
    auto ts   = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()).count();
    return Napi::String::New(env, detectionsToJson(camId, ts, dets, g_detector));
}

// startCapture(cameras: [{id,url}], callback, queueSize?) → void
Napi::Value StartCapture(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    if (info.Length() < 2) return env.Undefined();

    auto camArr = info[0].As<Napi::Array>();
    auto cb     = info[1].As<Napi::Function>();
    int qSize   = info.Length() > 2 ? info[2].As<Napi::Number>().Int32Value() : 30;

    // Stop existing
    g_workerRunning = false;
    if (g_workerThread.joinable()) g_workerThread.join();
    if (g_queue) g_queue->stop();
    g_cameras.clear();

    g_queue = std::make_unique<FrameQueue>(qSize);

    for (uint32_t i = 0; i < camArr.Length(); i++) {
        auto obj = camArr.Get(i).As<Napi::Object>();
        CameraConfig cfg;
        cfg.id  = obj.Get("id").As<Napi::String>();
        cfg.url = obj.Get("url").As<Napi::String>();
        if (obj.Has("reconnectDelay"))
            cfg.reconnectDelaySec = obj.Get("reconnectDelay").As<Napi::Number>().Int32Value();
        auto cam = std::make_unique<CameraCapture>(cfg, *g_queue);
        cam->start();
        g_cameras.push_back(std::move(cam));
    }

    g_tsfn = Napi::ThreadSafeFunction::New(env, cb, "nvr_detection_cb", 0, 1);
    g_workerRunning = true;

    float confThresh = 0.5f, nmsThresh = 0.45f;

    g_workerThread = std::thread([confThresh, nmsThresh]() {
        Frame f;
        while (g_workerRunning) {
            if (!g_queue->pop(f, 200)) continue;
            if (!g_detector.loaded) continue;

            auto dets = g_detector.detect(f.mat, confThresh, nmsThresh);
            if (dets.empty()) continue;

            std::string json = detectionsToJson(f.cameraId, f.timestamp, dets, g_detector);

            g_tsfn.BlockingCall([json](Napi::Env env, Napi::Function cb) {
                cb.Call({Napi::String::New(env, json)});
            });
        }
        g_tsfn.Release();
    });

    return env.Undefined();
}

// stopCapture() → void
Napi::Value StopCapture(const Napi::CallbackInfo& info) {
    g_workerRunning = false;
    if (g_queue) g_queue->stop();
    for (auto& cam : g_cameras) cam->stop();
    g_cameras.clear();
    if (g_workerThread.joinable()) g_workerThread.join();
    return info.Env().Undefined();
}

// isModelLoaded() → bool
Napi::Value IsModelLoaded(const Napi::CallbackInfo& info) {
    return Napi::Boolean::New(info.Env(), g_detector.loaded);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("loadModel",     Napi::Function::New(env, LoadModel));
    exports.Set("detectFrame",   Napi::Function::New(env, DetectFrame));
    exports.Set("startCapture",  Napi::Function::New(env, StartCapture));
    exports.Set("stopCapture",   Napi::Function::New(env, StopCapture));
    exports.Set("isModelLoaded", Napi::Function::New(env, IsModelLoaded));
    return exports;
}

NODE_API_MODULE(ai_nvr_core, Init)
