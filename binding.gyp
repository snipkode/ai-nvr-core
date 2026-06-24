{
  "targets": [{
    "target_name": "ai_nvr_core",
    "sources": ["src/cpp/addon.cpp"],
    "include_dirs": [
      "<!@(node -p \"require('node-addon-api').include\")",
      "/usr/local/include/opencv4",
      "/usr/include/opencv4"
    ],
    "libraries": [
      "-lopencv_core",
      "-lopencv_videoio",
      "-lopencv_imgproc",
      "-lopencv_dnn"
    ],
    "cflags_cc": ["-std=c++17", "-O2", "-fexceptions", "-frtti"],
    "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
    "conditions": [
      ["OS=='linux'", {
        "libraries+": ["-Wl,-rpath,/usr/local/lib"]
      }]
    ]
  }]
}
