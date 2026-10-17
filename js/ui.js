import { $ } from "./dom.js";

const NATURE_IMAGES = [
    "adam-kool.jpg", "anton-lecock.jpg", "cassie-boca.jpg", "daniel-jacob.jpg",
    "derek-thomson.jpg", "erol-ahmed.jpg", "fernando-strabuli.jpg", "hero-mountains.jpg",
    "matthew-smith.jpg", "nils-lindner.jpg", "raul-ling.jpg", "sonaal-bangera.jpg",
    "sophia-simoes.jpg", "weronika.jpg", "robynne-o.jpg", "rafael-peier.jpg", "maria-larsen.jpg",
    "peter-robbins.jpg", "peter-robbins.jpg", "daphne-fecheyr.jpg", "nils-leonhardt.jpg", "nata-ruta.jpg",
    "bob-brewer.jpg", "lisha-riabinina.jpg", "vitus-bever.jpg", "benjamin-lecomte.jpg", "marco-murakami.jpg",
    "maksim-shutov.jpg", "bill-eccles.jpg", "michael-rodock.jpg", "konstantin-dyadyun.jpg", "hidde-joustra.jpg"
];
export function pickRNatureImage() {
    const filename = NATURE_IMAGES[Math.floor(Math.random() * NATURE_IMAGES.length)];
    const name = filename.replace(".jpg", "").split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
    return { path: `/assets/img/nature/${filename}`, credit: name };
}
export function showError(message) {
    const existing = $("errorOverlay");
    if (existing) existing.remove();
    const errorOverlay = document.createElement("div");
    const errorBox = document.createElement("div");
    errorBox.innerText = message;
    const errorBtn = document.createElement("button");
    errorBtn.innerText = "OK";
    errorBtn.className = "danger-btn";
    errorBox.id = "errorBox";

    errorOverlay.id = "errorOverlay";

    errorBtn.addEventListener("click", () => {
        errorOverlay.remove();
    });
    errorOverlay.appendChild(errorBox);
    errorBox.appendChild(errorBtn);

    document.body.appendChild(errorOverlay);
    return;
}
export function showConfirmDialog(message, onConfirm) {
    const existing = $("errorOverlay");
    if (existing) existing.remove();

    const errorOverlay = document.createElement("div");
    const errorBox = document.createElement("div");
    errorBox.innerText = message;

    const btnContainer = document.createElement("div");
    btnContainer.className = "dialog-btn-container";

    const errorBtn = document.createElement("button");
    errorBtn.innerText = "OK";
    errorBtn.className = "danger-btn";

    const cancelBtn = document.createElement("button");
    cancelBtn.innerText = "Cancel";
    cancelBtn.className = "blue-btn";

    errorBox.id = "errorBox";
    errorOverlay.id = "errorOverlay";

    errorBtn.addEventListener("click", () => {
        errorOverlay.remove();
        if (onConfirm) onConfirm();
    });

    cancelBtn.addEventListener("click", () => {
        errorOverlay.remove();
    });
    btnContainer.appendChild(errorBtn);
    btnContainer.appendChild(cancelBtn);

    errorBox.appendChild(btnContainer);
    errorOverlay.appendChild(errorBox);
    document.body.appendChild(errorOverlay);
}