let loadingSection;
let loadingBarFill;

let steps;
let currentStep;
let isStarted = false;

document.addEventListener("DOMContentLoaded", () => {
    loadingSection = document.querySelector("#loading-section");
    loadingBarFill = document.querySelector("#loading-bar-fill");
})

function startLoadingBar(numberOfSteps) {
    if (isStarted) {
        throw new Error("Loading bar is already started");
    }
    if (numberOfSteps <= 0) {
        throw new Error("Number of steps must be greater than 0");
    }

    loadingSection.style.visibility = "visible";
    loadingSection.style.opacity = "1";
    steps = numberOfSteps;
    currentStep = 0;
    isStarted = true;
}

function stepLoadingBar() {
    if (!isStarted) {
        throw new Error("Loading bar is not started");
    }
    currentStep += 1;
    loadingBarFill.style.width = `${(currentStep / steps) * 100}%`;
}

function finishLoadingBar() {
    if (!isStarted) {
        throw new Error("Loading bar is not started");
    }
    isStarted = false;
    loadingSection.style.visibility = "hidden";
    setTimeout(() => {
        loadingSection.style.opacity = "0";
        setTimeout(() => {
            loadingBarFill.style.width = "0%";
        }, 200);
    })
}