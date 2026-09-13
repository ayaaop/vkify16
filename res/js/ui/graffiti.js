vkify.once("graffiti", function () {
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function ensureLCLoaded() {
    if (window.LC) return;
    const base = "/assets/packages/static/openvk/js/";
    const lcCss =
      base + "node_modules/literallycanvas/lib/css/literallycanvas.css";
    if (!document.querySelector(`link[href="${lcCss}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = lcCss;
      document.head.appendChild(link);
    }
    if (!window.React)
      await loadScript(
        base + "node_modules/react/dist/react-with-addons.min.js",
      );
    if (!window.ReactDOM)
      await loadScript(base + "node_modules/react-dom/dist/react-dom.min.js");
    if (!window.LC) await loadScript(base + "vnd_literallycanvas.js");
  }

  async function openStockGraffiti(event) {
    try {
      if (typeof CMessageBox !== "function" || typeof window.u !== "function") {
        return;
      }

      const writeContainer = resolveWriteContainer(event);
      if (!writeContainer || !writeContainer.length) {
        return;
      }

      await ensureLCLoaded();

      if (
        typeof window.LC === "undefined" ||
        !window.LC ||
        typeof window.LC.init !== "function"
      ) {
        vkify.warn(
          "openStockGraffiti: LC not ready after load, LC=",
          window.LC,
        );
        return;
      }

      let canvas = null;
      const msgbox = new CMessageBox({
        title: tr("draw_graffiti"),
        body: "<div id='ovkDraw'></div>",
        close_on_buttons: false,
        warn_on_exit: true,
        buttons: [tr("save"), tr("cancel")],
        callbacks: [
          function () {
            try {
              canvas.getImage({ includeWatermark: false }).toBlob(
                (blob) => {
                  const fName =
                    "Graffiti-" +
                    Math.ceil(performance.now()).toString() +
                    ".jpeg";
                  const image = new File([blob], fName, {
                    type: "image/jpeg",
                    lastModified: new Date().getTime(),
                  });
                  if (typeof window.__uploadToTextarea === "function") {
                    window.__uploadToTextarea(image, writeContainer);
                  }
                },
                "image/jpeg",
                0.92,
              );
            } catch (e) {}

            try {
              canvas && canvas.teardown && canvas.teardown();
            } catch (e) {}
            msgbox.close();
          },
          async function () {
            try {
              const res = await msgbox.__showCloseConfirmationDialog();
              if (res === true) {
                try {
                  canvas && canvas.teardown && canvas.teardown();
                } catch (e) {}
                msgbox.close();
              }
            } catch (e) {
              try {
                canvas && canvas.teardown && canvas.teardown();
              } catch (e2) {}
              msgbox.close();
            }
          },
        ],
      });

      try {
        msgbox.getNode().attr("style", "width: 750px;");
      } catch (e) {}

      const watermarkImage = new Image();
      watermarkImage.src =
        "/assets/packages/static/openvk/img/logo_watermark.gif";

      canvas = window.LC.init(document.querySelector("#ovkDraw"), {
        backgroundColor: "#fff",
        imageURLPrefix:
          "/assets/packages/static/openvk/js/node_modules/literallycanvas/lib/img",
        watermarkImage: watermarkImage,
        imageSize: {
          width: 640,
          height: 480,
        },
      });
    } catch (e) {
      vkify.error("openStockGraffiti:", e);
    }
  }

  vkify.stockInitGraffiti = openStockGraffiti;

  function graffitiDispatcher(event) {
    try {
      if (window.vkify?.getSetting("vkGraffiti")) {
        openVKGraffiti(event);
      } else {
        openStockGraffiti(event);
      }
    } catch (e) {
      vkify.error?.("graffitiDispatcher:", e);
    }
  }

  window.initGraffiti = graffitiDispatcher;

  u(document).on("click", ".attach_graffiti", (e) => {
    window.graffitiWriteContext = u(e.target).closest("#write");
  });

  function dataURLtoBlob(dataURL) {
    const arr = dataURL.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  function getThemeAsset(path) {
    return window.vkify?.themeUrl?.(path) ?? path;
  }

  function getResourceAsset(path) {
    return window.vkify?.resourceUrl?.(path) ?? path;
  }

  function resolveWriteContainer(event) {
    try {
      const t = event && event.target ? event.target : null;
      if (typeof u === "function" && t) {
        const ctx = u(t).closest("#write");
        if (ctx && ctx.length) return ctx;
      }
    } catch (e) {}

    if (window.graffitiWriteContext && window.graffitiWriteContext.length) {
      return window.graffitiWriteContext;
    }

    if (typeof u === "function") {
      return u("#write");
    }
    return null;
  }

  function openVKGraffiti(event) {
    if (typeof CMessageBox !== "function" || typeof window.u !== "function") {
      return;
    }

    const writeContainer = resolveWriteContainer(event);
    if (!writeContainer || !writeContainer.length) {
      return;
    }

    const iframeContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="${getThemeAsset("/stylesheet/styles.css")}">
    <link rel="stylesheet" href="${getResourceAsset("/css/ui_common.css")}">
    <link rel="stylesheet" href="${getResourceAsset("/vkgraffiti/graffiti.css")}">
    ${window.vkify.getSetting("darkMode") ? `<link rel="stylesheet" href="${window.vkify.resourceUrl("css")}/dark-mode.css" id="dark-mode-css">` : ""}
    <style>
        html, body {
            overflow: hidden !important;
            margin: 0;
            padding: 0;
        }
    </style>
</head>
<body ${window.vkify.getSetting("darkMode") ? 'class="dark-mode"' : ""} style="background: var(--module-background-color); margin: 0;">
    <div style="background-color: var(--body-background-color); padding-bottom: 1px;">
        <div id="graffiti_topbar">
            <a href="#" onclick="Graffiti.backHistory(); return false;">${window.vkifylang ? window.vkifylang.graffitibackhistory : "Undo"}</a>
            <a href="#" onclick="Graffiti.flushHistory(); return false;">${window.vkifylang ? window.vkifylang.graffitiflushhistory : "Clear"}</a>
        </div>
        <div id="graffiti_aligner">
            <canvas id="graffiti_common" width="586" height="350"></canvas>
            <canvas id="graffiti_overlay" width="586" height="350"></canvas>
            <canvas id="graffiti_helper" width="586" height="350"></canvas>
        </div>
        <div id="graffiti_resizer" style="margin-top: 5px;"></div>
    </div>
    <div id="graffiti_controls_wrapper">
        <div id="graffiti_controls">
            <canvas id="graffiti_sample" width="66" height="66"></canvas>
            <div class="graffiti_control_group graffiti_color_group">
                <span class="graffiti_label" data-key="graffiti_flash_color">${window.vkifylang ? window.vkifylang.graffiticolor : "Color:"}</span>
                <button type="button" class="graffiti_color_btn" id="graffiti_color_btn" aria-label="${window.vkifylang ? window.vkifylang.graffiticolor : "Color"}">
                    <span class="graffiti_color_preview"></span>
                </button>
            </div>
            <div class="graffiti_control_group graffiti_size_group">
                <span class="graffiti_label" data-key="graffiti_flash_thickness">${window.vkifylang ? window.vkifylang.graffitithickness : "Thickness:"}</span>
                <div class="graffiti_slider" id="graffiti_size_slider" data-min="1" data-max="64"></div>
            </div>
            <div class="graffiti_control_group graffiti_opacity_group">
                <span class="graffiti_label" data-key="graffiti_flash_opacity">${window.vkifylang ? window.vkifylang.graffitiopacity : "Opacity:"}</span>
                <div class="graffiti_slider" id="graffiti_opacity_slider" data-min="1" data-max="100"></div>
            </div>
        </div>
    </div>
    <div id="graffiti_cpwrap" style="display:none;">
        <div id="graffiti_cpicker">
            <div class="graffiti_color_grid"></div>
            <label class="graffiti_color_native" aria-label="${window.vkifylang ? window.vkifylang.graffiticolor : "Color"}">
                <input type="color" id="graffiti_color_native" value="#336699" aria-label="${window.vkifylang ? window.vkifylang.graffiticolor : "Color"}">
                <span class="graffiti_color_native_preview"></span>
            </label>
        </div>
    </div>
    <canvas id="graffiti_hist_helper" width="1172" height="350" style="display:none;"></canvas>
    <script src="${getResourceAsset("/vkgraffiti/graffiti.js")}"></script>
    <script>
        var cur = {"lang": {
            "graffiti_flash_color": "${window.vkifylang ? window.vkifylang.graffiticolor : "Color:"} ",
            "graffiti_flash_opacity": "${window.vkifylang ? window.vkifylang.graffitiopacity : "Opacity:"} ",
            "graffiti_flash_thickness": "${window.vkifylang ? window.vkifylang.graffitithickness : "Thickness:"} ",
            "graffiti_color": "${window.vkifylang ? window.vkifylang.graffiticolor : "Color"}",
            "graffiti_undo": "${window.vkifylang ? window.vkifylang.graffitibackhistory : "Undo"}",
            "graffiti_clear": "${window.vkifylang ? window.vkifylang.graffitiflushhistory : "Clear"}"
        }};
        window.onload = function() {
            Graffiti.init();
        };
    </script>
</body>
</html>
`;

    const escapedIframeContent = iframeContent
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const msgbox = new CMessageBox({
      title: tr("draw_graffiti"),
      body: `<iframe id="graffiti-iframe" style="width: 100%; height: 100%; border: medium;" srcdoc="${escapedIframeContent}" tabindex="0"></iframe>`,
      close_on_buttons: false,
      warn_on_exit: true,
      buttons: [tr("save"), tr("cancel")],
      callbacks: [
        function () {
          try {
            const iframe = msgbox.getNode().find("iframe").nodes[0];
            const gw =
              iframe && iframe.contentWindow ? iframe.contentWindow : null;
            if (
              !gw ||
              !gw.Graffiti ||
              typeof gw.Graffiti.getImage !== "function"
            ) {
              return;
            }

            gw.Graffiti.getImage(function (dataURL) {
              const blob = dataURLtoBlob(dataURL);
              const fName =
                "Graffiti-" + Math.ceil(performance.now()).toString() + ".jpeg";
              const image = new File([blob], fName, {
                type: "image/jpeg",
                lastModified: new Date().getTime(),
              });

              if (typeof window.__uploadToTextarea === "function") {
                window.__uploadToTextarea(image, writeContainer);
              }
            });
          } catch (e) {}

          msgbox.close();
        },
        async function () {
          try {
            const res = await msgbox.__showCloseConfirmationDialog();
            if (res === true) {
              msgbox.close();
            }
          } catch (e) {
            msgbox.close();
          }
        },
      ],
    });

    const isMobile = window.matchMedia("(max-width: 620px)").matches;
    const msgboxsel = document.querySelector(
      `.ovk-diag-cont.ovk-msg-all[data-id="${msgbox.id}"]`,
    );
    if (msgboxsel) {
      msgboxsel.style.width = isMobile ? "100%" : "800px";
      msgboxsel.style.maxWidth = isMobile ? "100vw" : "";
      msgboxsel.classList.add("vkify-graffiti-diag", "ovk-msg-sheet");
    }
    const diagBody = msgbox.getNode().find(".ovk-diag-body").nodes[0];
    if (diagBody) {
      diagBody.classList.add("vkify-graffiti-body");
    }
    msgbox
      .getNode()
      .find(".ovk-diag-body")
      .attr(
        "style",
        "height:491px; max-height: 721px; overflow: hidden; padding: 0!important",
      );

    const iframe = msgbox.getNode().find("iframe").nodes[0];
    setTimeout(() => {
      try {
        iframe && iframe.focus();
      } catch (e) {}
    }, 100);
    try {
      iframe &&
        iframe.addEventListener("click", () => {
          try {
            iframe.focus();
          } catch (e) {}
        });
    } catch (e) {}
  }

  if (!window.initVKGraffiti || window.initVKGraffiti.__vkifyIsGraffitiStub) {
    window.initVKGraffiti = openVKGraffiti;
  }

  if (!window.vkifyGraffiti || window.vkifyGraffiti.__vkifyIsGraffitiStub) {
    window.vkifyGraffiti = function (e) {
      const contextToUse =
        window.graffitiWriteContext && window.graffitiWriteContext.length
          ? { target: window.graffitiWriteContext.nodes[0] }
          : e;

      if (window.vkify?.getSetting("vkGraffiti")) {
        openVKGraffiti(contextToUse);
      } else {
        openStockGraffiti(contextToUse);
      }

      if (window.graffitiWriteContext) {
        window.graffitiWriteContext = null;
      }
    };
  }
});
