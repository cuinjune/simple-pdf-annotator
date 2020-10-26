const isMacLike = /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform);
const url = "https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf";
const pdfjsLib = window["pdfjs-dist/build/pdf"];
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.6.347/pdf.worker.min.js";
const uploadScale = 2; // pdf resolution
const downloadScale = 0.75; // exported pdf size in scale
let pdfDoc = null;
let renderCount = 0;
let renderingFinished = false;
let fileName = "";
let penType = document.getElementById("select-pen").value;
let isMouseDown = false;
let drawingCanvas = {
    canvas: null,
    rect: null,
    scaleX: 0,
    scaleY: 0
}
let strokes = [];
let strokeIndex = 0;
let pointIndex = 0;

function drawLine(x1, y1, x2, y2, r1, r2) {
    // calculate direction vector of point 1 and 2
    const directionVectorX = x2 - x1;
    const directionVectorY = y2 - y1;
    // calculate angle of perpendicular vector
    const perpendicularVectorAngle = Math.atan2(directionVectorY, directionVectorX) + Math.PI / 2;
    // construct shape
    const path = new Path2D();
    path.arc(x1, y1, r1, perpendicularVectorAngle, perpendicularVectorAngle + Math.PI);
    path.arc(x2, y2, r2, perpendicularVectorAngle + Math.PI, perpendicularVectorAngle);
    path.closePath();
    return path;
}

function drawStrokes() {
    requestAnimationFrame(drawStrokes);
    const numStrokes = strokes.length;
    for (let i = strokeIndex; i < numStrokes; i++) {
        const ctx = strokes[i].ctx;
        const penType = strokes[i].penType;
        const points = strokes[i].points;
        let r = 0;
        if (penType === "pen") {
            // ctx.lineWidth = 1;
            // ctx.strokeStyle = "rgb(50, 54, 57)";
            // ctx.lineCap = "round";
            r = 0.5;
        }
        else if (penType === "marker") {
            // ctx.lineWidth = 20;
            // ctx.strokeStyle = "rgba(118, 254, 192, 0.1)";
            // ctx.lineCap = "butt";
            r = 5;
        }
        if (pointIndex == 0) {
            ctx.moveTo(points[0].x, points[0].y);
        }
        const numPoints = points.length;
        for (let j = 0; j < numPoints - 1; j++) {
            const line = drawLine(points[j].x, points[j].y, points[j + 1].x, points[j + 1].y, r, r);
            ctx.fill(line);
        }
        ctx.stroke();
    }
}
drawStrokes();

function renderPage(num, canvas, ctx) {
    pdfDoc.getPage(num).then(function (page) {
        var viewport = page.getViewport({ scale: uploadScale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        var renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        var renderTask = page.render(renderContext);
        renderTask.promise.then(function () {
            console.log(`Page ${num}/${pdfDoc.numPages} rendering finished`);
            if (++renderCount === pdfDoc.numPages) {
                console.log("All pages rendering finished");
                renderingFinished = true;
            }
        });
    });
}

function renderAllPages(pdfDoc_) {
    pdfDoc = pdfDoc_;
    window.scrollTo(0, 0);
    document.getElementById("page").textContent = `1 / ${pdfDoc.numPages}`;
    const canvasWrapper = document.getElementById("canvas-wrapper");
    canvasWrapper.innerHTML = "";
    renderCount = 0;
    renderingFinished = false;
    for (let i = 0; i < pdfDoc.numPages; i++) {
        const canvas = document.createElement("canvas");
        canvas.classList.add("canvas");
        if (i > 0) {
            canvas.classList.add("page-break");
        }
        canvas.id = `canvas${i}`;
        canvasWrapper.appendChild(canvas);
        const ctx = canvas.getContext("2d");
        renderPage(i + 1, canvas, ctx);
    }
    canvasWrapper.addEventListener("mousedown", function (e) {
        if (isMouseDown || !(e.target instanceof HTMLCanvasElement)) {
            return;
        }
        const canvas = e.target;
        const ctx = canvas.getContext("2d");
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        const point = {
            x: x,
            y: y
        };
        const stroke = {
            ctx: ctx,
            penType: penType,
            points: [point]
        }
        strokes.push(stroke);
        drawingCanvas.canvas = canvas;
        drawingCanvas.rect = rect;
        drawingCanvas.scaleX = scaleX;
        drawingCanvas.scaleY = scaleY;
        isMouseDown = true;
    });

    function finishStroke() {
        if (isMouseDown) {
            strokeIndex++;
            pointIndex = 0;
            drawingCanvas.canvas = null;
            isMouseDown = false;
        }
    }

    canvasWrapper.addEventListener("mousemove", function (e) {
        if (!isMouseDown) {
            return;
        }
        if (e.target !== drawingCanvas.canvas) {
            finishStroke();
            return;
        }
        const x = (e.clientX - drawingCanvas.rect.left) * drawingCanvas.scaleX;
        const y = (e.clientY - drawingCanvas.rect.top) * drawingCanvas.scaleY;
        const point = {
            x: x,
            y: y
        };
        strokes[strokes.length - 1].points.push(point);
    });

    canvasWrapper.addEventListener("mouseup", function (e) {
        finishStroke();
    });

    canvasWrapper.addEventListener("mouseout", function (e) {
        finishStroke();
    });
}

function uploadPDF(file) {
    if (file.name.split('.').pop() !== "pdf") {
        alert("Please upload a PDF file.");
        return;
    }
    const fileReader = new FileReader();
    fileReader.onload = function () {
        const typedarray = new Uint8Array(this.result);
        const loadingTask = pdfjsLib.getDocument(typedarray);
        loadingTask.promise.then(pdfDoc_ => {
            fileName = file.name;
            renderAllPages(pdfDoc_);
        }, function () {
            alert("The uploaded PDF file is corrupted.");
            return;
        });
    };
    fileReader.readAsArrayBuffer(file);
}

document.getElementById("upload").addEventListener("change", function (e) {
    const file = e.target.files[0];
    uploadPDF(file);
});

document.getElementById("download").addEventListener("click", function (e) {
    kendo.drawing.drawDOM("#canvas-wrapper", {
        forcePageBreak: ".page-break",
        paperSize: "auto",
        scale: downloadScale
    }).then(function (group) {
        kendo.drawing.pdf.saveAs(group, fileName);
    })
});

window.addEventListener("scroll", function (e) {
    const canvases = document.getElementsByClassName("canvas");
    for (let i = 0; i < canvases.length; i++) {
        const canvas = canvases[i];
        const canvasRect = canvas.getBoundingClientRect();
        const windowHeight = (window.innerHeight || document.documentElement.clientHeight);
        const windowWidth = (window.innerWidth || document.documentElement.clientWidth);
        const vertInView = (canvasRect.top <= windowHeight) && ((canvasRect.top + canvasRect.height * 0.75) >= 0);
        const horInView = (canvasRect.left <= windowWidth) && ((canvasRect.left + canvasRect.width) >= 0);
        if (vertInView && horInView) {
            document.getElementById("page").textContent = `${Math.min(i + 1, pdfDoc.numPages)} / ${pdfDoc.numPages}`;
            break;
        }
    }
});

document.getElementById("select-pen").addEventListener("change", function (e) {
    console.log(this.value);
    penType = this.value;
});

function highlightDraggedElement(element) {
    if (element.id.substring(0, 6) === "canvas") {
        element.style.opacity = "0.5";
    }
    else if (element === document.body) {
        document.body.style.backgroundColor = "rgb(72, 76, 79)";
    }
}

function revertDraggedElement(element) {
    if (element.id.substring(0, 6) === "canvas") {
        element.style.opacity = "1.0";
    }
    else if (element === document.body) {
        document.body.style.backgroundColor = "rgb(82, 86, 89)";
    }
}

document.body.addEventListener("dragenter", function (e) {
    e.preventDefault();
    highlightDraggedElement(e.target);
});

document.body.addEventListener("dragleave", function (e) {
    e.preventDefault();
    revertDraggedElement(e.target);
});

document.body.addEventListener("dragover", function (e) {
    e.preventDefault();
});

document.body.addEventListener("drop", function (e) {
    e.preventDefault();
    revertDraggedElement(e.target);
    const file = e.dataTransfer.files[0];
    uploadPDF(file);
});

window.addEventListener("keydown", function (e) {
    e = e || window.event;
    const modifierKey = isMacLike ? e.metaKey : e.ctrlKey;
    if (modifierKey) {
        const key = e.which || e.keyCode || 0;
        switch (String.fromCharCode(key).toLowerCase()) {
            case "z":
                if (e.shiftKey) { // redo
                    e.preventDefault();

                }
                else { // undo
                    e.preventDefault();
                }
                break;
        }
    }
});

pdfjsLib.getDocument(url).promise.then(function (pdfDoc_) {
    fileName = url.substring(url.lastIndexOf("/") + 1);
    renderAllPages(pdfDoc_);
});