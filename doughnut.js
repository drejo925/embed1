/*
MIT License

Copyright (c) 2021-23 Jeremy Johnson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

class _DoughnutDimensions {
    constructor(type, maxVal) {
        this.type = type;
        this.maxVal = maxVal;
        // Array of dimension objects, which contain array of levels:
        //  {name: "", levels: [{value: N, label: ""}, ...]}
        this._showLabels = true;
        this.dimensions = [];
    }
    add(name, value, label) {
        if (name) {
            let val = parseInt(value);
            if (val > this._normalDonutLevelRadius) { val = this.maxVal; }
            if (val < this._minDonutLevelRadius) { val = "NaN"; }
            let level = { value: val, label: label };
            let index = this.find(name);
            if (index >= 0) {
                let found = false;
                for (let lvl of this.dimensions[index].levels) {
                    if (label == "undefined") { label = "" }
                    if (lvl.label == label || (!lvl.label && !label)) {
                        // Update existing level
                        lvl.value = val;
                        found = true;
                    }
                }
                // Add new level
                if (!found) { this.dimensions[index].levels.push(level); }
            } else {
                // New dimension
                this.dimensions.push({ name: name, levels: [level] });
            }
        }
    }
    get(index) {
        return this.dimensions[index];
    }
    delete(index, level_num) {
        this.dimensions[index].levels.splice(level_num, 1);
        if (this.dimensions[index].levels.length == 0) {
            this.dimensions.splice(index, 1);
        }
    }
    deleteLast() {
        if (this.dimensions.length > 0) {
            this.dimensions.pop();
        }
    }
    length() {
        return this.dimensions.length;
    }
    clear() {
        this.dimensions = [];
    }
    string() {
        let string = "";
        for (let dimNo = 0; dimNo < this.dimensions.length; dimNo++) {
            let dim = this.dimensions[dimNo];
            if (dimNo > 0) { string += " / " }
            string += dim.name + ":";
            for (let lvlNo = 0; lvlNo < dim.levels.length; lvlNo++) {
                let level = dim.levels[lvlNo];
                if (lvlNo > 0) { string += "," }
                if (level.label) { string += level.label + "=" }
                string += level.value;
            }
        }
        return string;
    }
    // Outputs as rows:
    // DimensionType, DimensionName, LevelValue, LevelLabel
    export() {
        let csv = [];
        for (let dimNo = 0; dimNo < this.dimensions.length; dimNo++) {
            let dim = this.dimensions[dimNo];
            for (let level of dim.levels) {
                let row = this.type + "," + dim.name + ",";
                let label = "";
                if (level.label) { label = level.label }
                row += level.value + "," + label;
                csv.push(row);
            }
        }
        return csv.join("\n");
    }
    find(name) {
        let num = 0;
        for (let dim of this.dimensions) {
            if (dim.name == name) {
                return num;
            }
            num++;
        }
        return -1;
    }
    // Inputs rows:
    // DimensionType, DimensionName, LevelValue, LevelLabel
    import(text) {
        let errors = 0;
        let csv = text.split("\n");
        for (let row of csv) {
            let cols = row.split(",");
            if (cols.length == 4) {
                if (cols[0] == this.type) {
                    this.add(cols[1], cols[2], cols[3]);
                }
            } else {
                errors++;
            }
        }
        return errors;
    }
}

class Doughnut {
    // size: Size of whole doughnut
    // donutScale: scaling factor for the doughnut (between 0.5 and 1.5)
    // textSize: text size
    // canvasId: Id of canvas element to draw the doughnut into
    // divId: Id of div element that canvas is in (to allow resize correctly)
    // infoId: Optional id of doughnut dimension info
    // innerId: Optional id of paragraph to show inner dimensions list
    // outerId: Optional id of paragraph to show outer dimensions list
    // exportId: Optional id of textarea to show export CSV string
    constructor(size, donutScale, textSize, canvasId, divId, infoId, innerId, outerId, exportId) {
        this._donutSize = size;
        this._textSize = textSize;
        if (donutScale >= 0.5 && donutScale <= 1.5) {
            this._donutScale = donutScale;
        } else {
            this._donutScale = 1.0;
        }
        this._canvasId = canvasId;
        this._divId = divId;
        this._infoId = infoId;
        this._innerId = innerId;
        this._outerId = outerId;
        this._exportId = exportId;

        //this._debug("size: " + this._donutSize + " / scale: " + this._donutScale);

        // Fudge factor adjusetment for hard coded values to be scaled based on given size
        let fudge = (size / 640); // og: 

        // Size of doughnut dimensions
        this._middleX = this._donutSize / 2;
        this._middleY = this._donutSize / 2;
        this._donutLineSize = Math.round(16 * fudge);  // For the outer/inner safe zone lines
        this._donutMargin = Math.round(150 * fudge);   // The space around the whole doughnut diagram
        this._section = (this._donutSize - this._donutMargin) / 8;

        //changed to get rid of inner circle
        this._inInner = 0;

        this._donutRingSize = this._section * this._donutScale;
        let overlapDonut = (this._donutRingSize - this._section) / 2;
        //this._debug("section: " + this._section + " / donutRingSize: " + this._donutRingSize + " / overlap: " + overlapDonut);
        
        //this._outInner = this._inInner + this._section - overlapDonut; <- original code - i changed to keep spcae in inner circle
        this._outInner = this._section + this._section - overlapDonut;

        this._inDonut = this._outInner;
        this._outDonut = this._inDonut + this._donutRingSize;
        this._midDonut = this._inDonut + (this._outDonut - this._inDonut) / 2;
        this._inOuter = this._outDonut;

        //Modified to be 1.5 X bigger - took away
        this._outOuter = this._inOuter + (this._section - overlapDonut) * 1.5;
        this._extraDonut = this._outOuter + Math.round((25* 1.5) * fudge);   // For the complete overshoot

        this._arcLineWidth = 2;
        this._textInner = this._outInner + (this._section / 2);
        this._textOuter = this._outOuter - this._textSize;
        this._donutFrosting = "rgb(3,134,173)";
        this._donutFilling = "rgb(126,208,247)";

        // Dimension level values
        this._minDonutLevelRadius = -100;
        this._normalDonutLevelRadius = 100;
        this._maxDonutLevelRadius = 150;    // For maximum overshoot! (change since I made bigger? 150* 1.5)

        this._canvas = document.getElementById(canvasId);
        this._ctx = this._canvas.getContext("2d");
        // Set size of canvas & div to the required doughnut size
        this._canvas.style.width = this._donutSize;
        this._canvas.style.height = this._donutSize;
        this._canvas.width = this._donutSize;
        this._canvas.height = this._donutSize;
        let div = document.getElementById(divId);
        div.style.maxWidth = this._donutSize;

        this._grdGlobal = this._ctx.createRadialGradient(this._middleX, this._middleY, this._outOuter, this._middleX, this._middleY, this._extraDonut);
        this._grdGlobal.addColorStop(0, "rgb(251, 138, 152)");
        this._grdGlobal.addColorStop(1, "white");

        this._grd = this._grdGlobal;
        this._innerDims = new _DoughnutDimensions("inner", this._normalDonutLevelRadius);
        this._outerDims = new _DoughnutDimensions("outer", this._maxDonutLevelRadius);
        this._innerPaths = null;
        this._outerPaths = null;
        this._selectedDimInfo = null;
        this._hoveredDimInfo = null;

        this._canvas.addEventListener("mousemove", (e) => { this._checkMouse(e, false) });
        //this._canvas.addEventListener("click", (e) => { this._checkMouse(e, true) });

        // Call first draw
        this.update();
    }

    _matchingDimInfos(one, two) {
        if (!one && !two) { return true; }
        if (!one || !two) { return false; }
        if (one.dim_type == two.dim_type &&
            one.dim_num == two.dim_num &&
            one.lvl_num == two.lvl_num) { return true; }
        return false;
    }

    _getDimInfoText(dimInfo) {
        let info = dimInfo.dim_info;
        let text = info.name;
        let lvl = dimInfo.lvl_num;
        if (info.levels[lvl].label) { text += " (measure: " + info.levels[lvl].label + ")" }
        text += " = " + info.levels[lvl].value;
        return text;
    }

    _checkMouse(e, click) {
        let hoverDimInfo = this._checkMouseOver(e.offsetX, e.offsetY);
        let hoverText = "";
        if (hoverDimInfo) {
            this._canvas.style.cursor = "crosshair";
            hoverText = this._getDimInfoText(hoverDimInfo);
            if (click) {
                if (this._matchingDimInfos(this._selectedDimInfo, hoverDimInfo)) {
                    // Unselect
                    this._selectedDimInfo = null;
                } else {
                    // New selection
                    this._selectedDimInfo = hoverDimInfo;
                }
                this.update()
            }
        } else {
            this._canvas.style.cursor = "default";
            hoverText = "None";
        }
        this._updateInfo(hoverText);
    }

    _updateInfo(hoverText) {
        if (this._infoId) {
            let selectText = "None"
            if (this._selectedDimInfo) {
                selectText = this._getDimInfoText(this._selectedDimInfo);
            }
            let html = "<p>Hover: " + hoverText + "</p><p>Select: " + selectText + "</p>";
            document.getElementById(this._infoId).innerHTML = html;
        }
    }
    _checkMousePathsDims(dims, paths, x, y) {
        let found = null;
        //this._debug(x + "," + y);
        let dim = 0, lvl = 0;
        for (dim = 0; dim < dims.length(); dim++) {
            let subpaths = paths[dim];
            for (lvl = 0; lvl < subpaths.length; lvl++) {
                if (this._ctx.isPointInPath(subpaths[lvl], x, y)) {
                    //this._debug("found");
                    found = {
                        dim_num: dim,
                        dim_type: dims.type,
                        dim_info: dims.get(dim),
                        lvl_num: lvl,
                        path: subpaths[lvl]
                    };
                    break;
                }
            }
            if (found) { break; }
        }
        return found;
    }

    _checkMouseOver(x, y) {
        let hoverDimInfo = null;
        if (this._innerPaths != null) {
            hoverDimInfo = this._checkMousePathsDims(this._innerDims, this._innerPaths, x, y);
        }
        if (!hoverDimInfo && this._outerPaths != null) {
            hoverDimInfo = this._checkMousePathsDims(this._outerDims, this._outerPaths, x, y);
        }
        return hoverDimInfo;
    }

    addDimension(type, name, level, label) {
        if (type == "outer") {
            this._outerDims.add(name, level, label);
        } else if (type == "inner") {
            this._innerDims.add(name, level, label);
        }
        this._selectedDimInfo = null;
        this._updateInfo("None");
        this.update();
    }

    delSelectedDimension() {
        if (this._selectedDimInfo) {
            if (this._selectedDimInfo.dim_type == "outer") {
                this._outerDims.delete(this._selectedDimInfo.dim_num, this._selectedDimInfo.level_num);
            } else {
                this._innerDims.delete(this._selectedDimInfo.dim_num, this._selectedDimInfo.level_num);
            }
            this._selectedDimInfo = null;
            this._updateInfo("None");
            this.update();
        }
    }

    getSelectedDimension() {
        if (this._selectedDimInfo) {
            let info = this._selectedDimInfo.dim_info;
            let lvl = this._selectedDimInfo.lvl_num;
            let label = "";
            if (info.levels[lvl].label) { label = info.levels[lvl].label };
            return {
                type: this._selectedDimInfo.dim_type,
                name: info.name,
                level: info.levels[lvl].value,
                label: label
            };
        }
        return null;
    }

    delLastDimension(type) {
        if (type == "outer") {
            this._outerDims.deleteLast();
        } else if (type == "inner") {
            this._innerDims.deleteLast();
        }
        this.update();
    }

    clearDoughnut() {
        this._innerDims.clear();
        this._outerDims.clear();
        this.update();
    }
    
    addDimension(type, name, level, label) {
        if (type == "outer") {
            this._outerDims.add(name, level, label);
        } else if (type == "inner") {
            this._innerDims.add(name, level, label);
        }
        this._selectedDimInfo = null;
        this._updateInfo("None");
        this.update();
    }

    isEmptyDoughnut() {
        return (this._innerDims.length() == 0 && this._outerDims.length() == 0)
    }

    // Import via CSV format:
    // Headings: "DimensionType", "DimensionName", "DimensionValue", "SubDimensionLabel"
    // Example:  Inner, income, 76, "male income"
    //           Inner, income, 81, "female income"
    //           Outer, "climate change", 150, ""
    import(text) {
        const failure = "Format errors\nExpects rows with 4 cols: type, name, value, sub-label\n   outer, climate change, 76,\n   inner, food, 20, imports\n   inner, food, 56, exports";
        let errors = this._innerDims.import(text);
        errors += this._outerDims.import(text);
        if (errors) {
            alert(failure);
        }
        this.update();
    }

    _isNotNumber(number) {
        return (Number.isNaN(number) || typeof number != 'number')
    }

    _drawDoughnut() {
        // Define the radii based on the visual structure boundaries
        const radiusOuterBandEdge = this._outDonut; // Outer edge of the entire doughnut structure
        const radiusLightBlueEdge = this._outDonut - this._donutLineSize; // Outer edge of the light blue band
        const radiusInnerBandEdge = this._inDonut + this._donutLineSize; // Outer edge of the inner dark blue band
        const radiusHoleEdge = this._inDonut; // Inner edge of the entire doughnut structure (start of the hole)

        // --- Draw the bands using layered filled circles (Largest to Smallest) ---
        // This approach avoids strokes and complex paths, relying on simple fills
        // which might be more robustly handled by canvas2svg.

        // 1. Dark blue circle (Largest) - Forms the base outer ring
        this._ctx.fillStyle = this._donutFrosting;
        this._ctx.beginPath();
        this._ctx.arc(this._middleX, this._middleY, radiusOuterBandEdge, 0, 2 * Math.PI);
        this._ctx.fill();

        // 2. Light blue circle - Covers the center, leaving the outer dark blue ring
        this._ctx.fillStyle = this._donutFilling;
        this._ctx.beginPath();
        this._ctx.arc(this._middleX, this._middleY, radiusLightBlueEdge, 0, 2 * Math.PI);
        this._ctx.fill();

        // 3. Dark blue circle (Smaller) - Covers the center, leaving the light blue ring
        this._ctx.fillStyle = this._donutFrosting;
        this._ctx.beginPath();
        this._ctx.arc(this._middleX, this._middleY, radiusInnerBandEdge, 0, 2 * Math.PI);
        this._ctx.fill();

        // 4. White circle (Smallest) - Covers the center, leaving the inner dark blue ring and creating the hole
        this._ctx.fillStyle = "white"; // Use white to match the background
        this._ctx.beginPath();
        this._ctx.arc(this._middleX, this._middleY, radiusHoleEdge, 0, 2 * Math.PI);
        this._ctx.fill();

        // Reset line width just in case, although fill doesn't use it.
        this._ctx.lineWidth = 1;

        // The original stroke-based or complex-path fill drawing is now completely replaced.
    }




    _splitText(text) {
        let words = text.split(" ");
        if (words.length <= 2) {
            // Only 1 or 2 words
            return words;
        }
        let half = text.length / 2;
        let result = [];
        let part = words[0];
        for (let word = 1; word < words.length; word++) {
            // Over half of length already or only one word left and no split yet - create split
            if (part.length >= half ||
                (result.length == 0 && words.length - word == 1)) {
                result.push(part);
                part = words[word];
            } else {
                part = part + " " + words[word];
            }
        }
        result.push(part);
        return result;
    }
    _writeDim(text, radius, angle, colour) {
        let x = this._middleX + radius * Math.cos(angle);
        let y = this._middleY + radius * Math.sin(angle);
        this._ctx.fillStyle = colour;
        this._ctx.shadowColor = "black";
        if (colour == "black") {
            this._ctx.shadowColor = "white";
        }
        this._ctx.shadowOffsetX = 1;
        this._ctx.shadowOffsetY = 1;
        let textParts = this._splitText(text);
        for (let part of textParts) {
            this._ctx.fillText(part, x, y);
            y = y + this._textSize;
        }
        this._ctx.shadowOffsetX = 0;
        this._ctx.shadowOffsetY = 0;
    }

    _writeDimensions(dimensions, radius, colour) {
        let arcDegrees = (2 * Math.PI) / dimensions.length();
        let arcStart = 0;
        for (let arc = 0; arc < dimensions.length(); arc++) {
            let arcEnd = arcStart + arcDegrees;
            this._writeDim(dimensions.get(arc).name, radius, arcStart + (arcDegrees / 2), colour);
            arcStart = arcEnd;
        }
    }

// Draw the supplied arcs - the structure of the next 3 args MUST match
// radiiOut: Outer radius lengths - always an array of arrays [[val1, val2], [val3], ...]
// radiiIn: Inner radius lengths - always an array of arrays [[val1, val2], [val3], ...]
// radiiColour: Colours - always an array of arrays [[col1, col2], [col3], ...]
// start: starting arc degrees (0 to 2pi) for the entire set of dimensions
// totalDegrees: total degrees to fill with all dimensions (usually 2 * Math.PI)
// max: Outer radius for Path2D hit detection
// min: Inner radius for Path2D hit detection
_drawArcsRange(radiiOut, radiiIn, radiiColour, start, totalDegrees, max, min) {
    let numTopLevelArcs = radiiOut.length; // Number of dimensions
    if (numTopLevelArcs === 0) return []; // Handle empty case

    let topLevelArcStart = start;
    let topLevelArcDegrees = totalDegrees / numTopLevelArcs; // Angle per dimension
    let paths = []; // Will store Path2D objects for hit detection

    // --- Configuration ---
    const dimensionGap = 0.04; // Increased gap
    const epsilonOverlap = 0.006; // Tiny overlap for adjacent sub-wedges
    // --- End Configuration ---

    // Iterate through each top-level dimension
    for (let dimIdx = 0; dimIdx < numTopLevelArcs; dimIdx++) {
        let topLevelArcEnd = topLevelArcStart + topLevelArcDegrees;

        // Calculate the drawable space for this dimension, accounting for gaps
        let drawableStart = topLevelArcStart + dimensionGap / 2;
        let drawableEnd = topLevelArcEnd - dimensionGap / 2;
        // Ensure drawable space isn't negative if gap is too large for the segment
        let drawableTotalDegrees = Math.max(0, drawableEnd - drawableStart);

        let dimOuterRadii = radiiOut[dimIdx]; // Array of outer radii for this dimension's levels
        let dimInnerRadii = radiiIn[dimIdx];   // Array of inner radii
        let dimColours = radiiColour[dimIdx]; // Array of colours
        let numLevels = dimOuterRadii.length; // Number of levels in this dimension
        if (numLevels === 0) continue; // Skip if a dimension has no levels

        let levelArcDegrees = drawableTotalDegrees / numLevels; // Angle per level wedge within drawable space

        // Initialize path array for this dimension
        paths[dimIdx] = [];

        // Iterate through the levels within the current dimension
        for (let levelIdx = 0; levelIdx < numLevels; levelIdx++) {
            let outerR = dimOuterRadii[levelIdx];
            let innerR = dimInnerRadii[levelIdx];
            let colour = dimColours[levelIdx];

            // Calculate precise angles for drawing this level wedge (within drawable space)
            let currentLevelStart = drawableStart + levelIdx * levelArcDegrees;
            let currentLevelEnd = currentLevelStart + levelArcDegrees;

            // --- Calculate angles for actual drawing (with potential overlap) ---
            let drawStart = currentLevelStart;
            let drawEnd = currentLevelEnd;

            // Add overlap to the end angle if it's a multi-level dimension and NOT the last level
            if (numLevels > 1 && levelIdx < numLevels - 1) {
                drawEnd += epsilonOverlap;
            }
            // --- End Drawing Angle Calculation ---


            // --- Draw the individual level wedge ---
            this._ctx.fillStyle = colour;
            this._ctx.beginPath();
            // Use the calculated drawStart and drawEnd angles
            this._ctx.arc(this._middleX, this._middleY, outerR, drawStart, drawEnd);
            this._ctx.arc(this._middleX, this._middleY, innerR, drawEnd, drawStart, true); // Reversed inner arc
            this._ctx.closePath();
            this._ctx.fill();
            // --- End Drawing ---


            // --- Path2D for Mouse Interaction ---
            // Calculate the *original* angular slice for hit detection (ignoring visual gap and overlap)
            let hitDetectLevelAngle = topLevelArcDegrees / numLevels;
            let hitDetectStart = topLevelArcStart + levelIdx * hitDetectLevelAngle;
            let hitDetectEnd = hitDetectStart + hitDetectLevelAngle;

            // Create Path2D covering the full original angular slice for this level
            let p = new Path2D();
            p.arc(this._middleX, this._middleY, max, hitDetectStart, hitDetectEnd);
            p.arc(this._middleX, this._middleY, min, hitDetectEnd, hitDetectStart, true);
            p.closePath();
            paths[dimIdx][levelIdx] = p; // Store path based on dimension and level index
            // --- End Path2D ---
        }
        topLevelArcStart = topLevelArcEnd; // Move to the next dimension's start angle
    }
    return paths;
}





_drawArcs(radiiOut, radiiIn, radiiColour, strokeColour, max, min) {
    // Note: strokeColour passed here is no longer used for individual wedge outlines
    // as those were removed earlier. It might be relevant if a global stroke is added later.
    this._ctx.lineWidth = this._arcLineWidth; // May not be needed if only filling
    this._ctx.strokeStyle = strokeColour; // May not be needed if only filling

    // Initial call to _drawArcsRange - isSubLevel is false (or defaults to false)
    let paths = this._drawArcsRange(radiiOut, radiiIn, radiiColour, 0, (2 * Math.PI), max, min, false);

    this._ctx.lineWidth = 1; // Reset line width
    return paths;
}


_drawDimensions(dims, extMax, extMin) {
    const INNER = 0;
    const OUTER = 1;
    let paths = null;

    // Define grey colors for gradients
    const greyColor = "rgb(211, 211, 211)"; // Standard lightgray
    const transparentGreyColor = "rgba(211, 211, 211, 0)"; // Transparent lightgray

    // --- Gradient Configuration ---
    // Value between 0 and 1. Higher value shifts transparency further away from the opaque end.
    // 0.0 = original (full transition)
    // 0.3 = starts/ends transparency 30% of the way into the gradient band
    const gradientShift = 0.3;
    // --- End Gradient Configuration ---


    if (dims.length() > 0) {
        let inRadii = [];
        let outRadii = [];
        let colRadii = [];
        // Scaling factors remain the same
        let extScale = (extMax - extMin) / this._normalDonutLevelRadius;
        let intScale = ((this._outDonut - this._inDonut) / 2) / this._normalDonutLevelRadius; // Used for negative overshoot only

        let type = null;
        let minRadiusForHitDetect = 0, maxRadiusForHitDetect = 0; // Renamed from min/max to avoid confusion

        // Determine type and hit detection boundaries
        if (extMax > this._outDonut) { // Corresponds to OUTER dimensions
            type = OUTER;
            minRadiusForHitDetect = this._inOuter; // Use defined boundaries for hit detection
            maxRadiusForHitDetect = this._outOuter;
        } else { // Corresponds to INNER dimensions
            type = INNER;
            minRadiusForHitDetect = this._inInner; // Use defined boundaries for hit detection
            maxRadiusForHitDetect = this._outInner;
        }

        for (let dim = 0; dim < dims.length(); dim++) {
            let levels = dims.get(dim).levels;
            let inArcs = [];
            let outArcs = [];
            let cols = [];
            for (let lvl = 0; lvl < levels.length; lvl++) {
                let val = levels[lvl].value;
                let outer = 0; // Outer radius for drawing the wedge
                let inner = 0; // Inner radius for drawing the wedge
                let col = this._grd; // Default: use the main pink gradient

                if (this._isNotNumber(val)) {
                    // --- Handle Invalid Data: Apply Grey Gradient ---
                    // For gradient purposes, treat invalid data as spanning the full band
                    inner = extMin;
                    outer = extMax;

                    if (type == INNER) {
                        // Inner wedge: Gradient Grey (outer) -> Transparent (inner)
                        col = this._ctx.createRadialGradient(this._middleX, this._middleY, inner, this._middleX, this._middleY, outer);
                        // Shift the start of transparency outwards
                        col.addColorStop(gradientShift, transparentGreyColor); // Transparent starts at gradientShift offset
                        col.addColorStop(1, greyColor);                      // Grey at outer radius (offset 1)
                    } else { // type == OUTER
                        // Outer wedge: Gradient Grey (inner) -> Transparent (outer)
                        col = this._ctx.createRadialGradient(this._middleX, this._middleY, inner, this._middleX, this._middleY, outer);
                        col.addColorStop(0, greyColor);                      // Grey at inner radius (offset 0)
                        // Shift the end of transparency inwards
                        col.addColorStop(1.0 - gradientShift, transparentGreyColor); // Transparent ends at 1-gradientShift offset
                    }
                    // --- End Gradient Handling ---

                } else {
                    // --- Handle Valid Data (including negative overshoot) ---
                    if (type == INNER) {
                        if (val < 0) {
                            // Negative value (overshoot inwards from outer edge)
                            inner = extMax; // Starts at the outer edge
                            outer = extMax + (val * intScale); // val is negative, so this moves inwards
                            col = "white"; // Keep negative overshoot white for now
                        } else {
                            // Normal positive value
                            inner = extMin + ((this._normalDonutLevelRadius - val) * extScale); // Calculate inner edge based on value
                            outer = extMax; // Extends to the outer edge
                            // col remains this._grd (default pink gradient)
                        }
                    } else { // type == OUTER
                        if (val < 0) {
                            // Negative value (overshoot inwards from inner edge)
                            inner = extMin + (val * intScale); // val is negative, so this moves inwards
                            outer = extMin; // Ends at the inner edge
                            col = "white"; // Keep negative overshoot white for now
                        } else {
                            // Normal positive value
                            inner = extMin; // Starts at the inner edge
                            let potentialOuter = extMin + (val * extScale); // Calculate potential outer edge
                    outer = Math.min(potentialOuter, this._middleX); // Cap the radius at the canvas edge
                    // col remains this._grd (default pink gradient)
                        }
                    }
                    // --- End Valid Data Handling ---
                }

                // Store calculated radii and color/gradient for this level
                inArcs.push(inner);
                outArcs.push(outer);
                cols.push(col);
            }
            // Store arrays for the entire dimension
            inRadii[dim] = inArcs;
            outRadii[dim] = outArcs;
            colRadii[dim] = cols;
        }

        // Call _drawArcs to draw all wedges for this type (INNER or OUTER)
        // Pass the correct hit detection radii (min/maxRadiusForHitDetect)
        paths = this._drawArcs(outRadii, inRadii, colRadii, "white", maxRadiusForHitDetect, minRadiusForHitDetect);
    }
    return paths;
}

    /**
     * Draws text curved along a specified radius and angle.
     * Handles character-by-character placement and rotation, including flipping for bottom half.
     * @param {string} text - The text string to draw.
     * @param {number} radius - The radius of the arc for the text baseline.
     * @param {number} centerAngle - The center angle (in radians) for the text block.
     * @param {string} color - The color of the text.
     * @param {number} fontSize - The font size in pixels.
     */
    _drawCurvedText(text, radius, centerAngle, color, fontSize) {
        if (!text || radius <= 0) return; // Basic validation

        const originalFont = this._ctx.font;
        const originalFillStyle = this._ctx.fillStyle;

        // Set specific style for this label
        this._ctx.font = fontSize + "px Roboto, Arial";
        this._ctx.fillStyle = color;
        this._ctx.textAlign = "center";   // Ensure correct alignment settings
        this._ctx.textBaseline = "middle";

        // --- Determine Rotation & Direction based on Angle ---
        let rotationOffset;
        let drawBackwards;
        // Ensure centerAngle is positive [0, 2*PI)
        let normalizedAngle = centerAngle % (2 * Math.PI);
        if (normalizedAngle < 0) normalizedAngle += (2 * Math.PI);

        // Check if angle is in the bottom half (using same logic as dynamic labels)
        if (normalizedAngle > 1e-9 && normalizedAngle < Math.PI - 1e-9) {
            // Bottom Half
            rotationOffset = -Math.PI / 2; // Upright relative to viewer
            drawBackwards = false;
        } else {
            // Top Half
            rotationOffset = Math.PI / 2; // Tangent to circle (upside down relative to center)
            drawBackwards = false;
        }
        // --- End Rotation & Direction ---

        // --- Calculate Text Angles ---
        const textWidth = this._ctx.measureText(text).width;
        const totalTextAngle = textWidth / radius; // Angle = ArcLength / Radius
        const textStartAngle = centerAngle - totalTextAngle / 2;
        const textEndAngle = centerAngle + totalTextAngle / 2;
        // --- End Text Angle Calculation ---

        // --- Draw Character by Character ---
        if (drawBackwards) {
            // Draw BOTTOM Half (Characters R->L, Angle decreasing)
            let currentAngle = textEndAngle;
            for (let i = text.length - 1; i >= 0; i--) {
                const char = text[i];
                const charWidth = this._ctx.measureText(char).width;
                const charAngleWidth = charWidth / radius;
                const charCenterAngle = currentAngle - charAngleWidth / 2;

                const x = this._middleX + radius * Math.cos(charCenterAngle);
                const y = this._middleY + radius * Math.sin(charCenterAngle);
                const rotation = charCenterAngle + rotationOffset;

                this._ctx.save();
                this._ctx.translate(x, y);
                this._ctx.rotate(rotation);
                this._ctx.fillText(char, 0, 0);
                this._ctx.restore();

                currentAngle -= charAngleWidth;
            }
        } else {
            // Draw TOP Half (Characters L->R, Angle increasing)
            let currentAngle = textStartAngle;
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                const charWidth = this._ctx.measureText(char).width;
                const charAngleWidth = charWidth / radius;
                const charCenterAngle = currentAngle + charAngleWidth / 2;

                const x = this._middleX + radius * Math.cos(charCenterAngle);
                const y = this._middleY + radius * Math.sin(charCenterAngle);
                const rotation = charCenterAngle + rotationOffset;

                this._ctx.save();
                this._ctx.translate(x, y);
                this._ctx.rotate(rotation);
                this._ctx.fillText(char, 0, 0);
                this._ctx.restore();

                currentAngle += charAngleWidth;
            }
        }
        // --- End Character Drawing ---

        // Restore original context settings
        this._ctx.font = originalFont;
        this._ctx.fillStyle = originalFillStyle;
        this._ctx.textAlign = "center"; // Assuming it was center before
        this._ctx.textBaseline = "middle"; // Assuming it was middle before
    }


    _drawLabels() {
        if (!this._showLabels) { // Check the flag
            return; // Skip drawing if flag is false
        }

        // --- Static Corridor Labels ---
        const staticLabelColor = "white";
        const smallerTextSize = Math.max(8, this._textSize * 0.90);
        const radiusLightBlueEdge = this._outDonut - this._donutLineSize;
        const radiusInnerBandEdge = this._inDonut + this._donutLineSize;
        const radiusHoleEdge = this._inDonut;
        const radiusOuterBandEdge = this._outDonut;

        // 1. "Sustainable quality care for all" - Bottom center
        const radiusLightBlueMid = (radiusInnerBandEdge + radiusLightBlueEdge) / 2;
        const angleBottomCenter = Math.PI / 2; // This is on the bottom half
        let sustainableText = "Sustainable quality care for all";

        // --- REVERSE THE TEXT STRING (Workaround for SVG export on bottom half) ---
        // Since angleBottomCenter is PI/2, it's always on the bottom half.
        sustainableText = sustainableText.split('').reverse().join('');
        // --- END REVERSE THE TEXT STRING ---

        this._drawCurvedText(
            sustainableText, // Pass the reversed string
            radiusLightBlueMid,
            angleBottomCenter,
            staticLabelColor,
            this._textSize * 1.1
        );

        // 2. "HEALTHCARE FOUNDATION" - Top center (No reversal needed)
        const radiusInnerDarkBlueMid = (radiusHoleEdge + radiusInnerBandEdge) / 2;
        const angleTopCenter = 3 * Math.PI / 2; // Top half
        this._drawCurvedText(
            "HEALTHCARE FOUNDATION", // Original string
            radiusInnerDarkBlueMid,
            angleTopCenter,
            staticLabelColor,
            smallerTextSize
        );

        // 3. "ECOLOGICAL CEILING" - Top center (No reversal needed)
        const radiusOuterDarkBlueMid = (radiusLightBlueEdge + radiusOuterBandEdge) / 2;
        // Use same angleTopCenter
        this._drawCurvedText(
            "ECOLOGICAL CEILING", // Original string
            radiusOuterDarkBlueMid,
            angleTopCenter,
            staticLabelColor,
            smallerTextSize
        );
        // --- End Static Corridor Labels ---

        // Reset context defaults specifically for dynamic labels
        // Using Roboto font and #484848 color as requested previously
        this._ctx.font = this._textSize + "px Roboto, Arial, sans-serif";
        this._ctx.fillStyle = "#484848";
        this._ctx.textAlign = "center";
        this._ctx.textBaseline = "middle";

        // --- Inner Labels (Curved, Flipped Bottom) ---
        let innerDims = this._innerDims;
        let defaultInnerLabelRadius = this._inDonut - this._textSize;
        defaultInnerLabelRadius = Math.max(this._textSize, defaultInnerLabelRadius);
        let numInnerArcs = innerDims.length();

        if (numInnerArcs > 0) {
            let innerArcDegrees = (2 * Math.PI) / numInnerArcs;

            for (let dim = 0; dim < numInnerArcs; dim++) {
                // --- GET ORIGINAL TEXT ---
                let text = innerDims.get(dim).name; // Get original text
                // --- END GET ORIGINAL TEXT ---

                let segmentCenterAngle = ((dim * innerArcDegrees) + (innerArcDegrees / 2)) % (2 * Math.PI);
                if (segmentCenterAngle < 0) segmentCenterAngle += (2 * Math.PI);

                let radiusToUse = defaultInnerLabelRadius;
                let rotationOffset;

                // Determine rotation offset based on angle AND REVERSE TEXT FOR BOTTOM HALF
                if (segmentCenterAngle > 1e-9 && segmentCenterAngle < Math.PI - 1e-9) {
                    // Bottom Half
                    rotationOffset = -Math.PI / 2; // Upright rotation

                    // --- REVERSE THE TEXT STRING (Workaround for SVG export) ---
                    text = text.split('').reverse().join(''); // Reverse the string here
                    // --- END REVERSE THE TEXT STRING ---

                } else {
                    // Top Half
                    rotationOffset = Math.PI / 2; // Tangent rotation
                    // Text remains unchanged for the top half
                }

                // --- Now proceed with calculations using the potentially reversed 'text' ---
                const textWidth = this._ctx.measureText(text).width;
                const totalTextAngle = (radiusToUse > 1) ? textWidth / radiusToUse : 0;
                const textStartAngle = segmentCenterAngle - totalTextAngle / 2;

                // --- Draw each character individually - ALWAYS FORWARDS (using potentially reversed text) ---
                let currentAngle = textStartAngle;
                for (let i = 0; i < text.length; i++) {
                    const char = text[i]; // Get character L->R from the (potentially reversed) string
                    const charWidth = this._ctx.measureText(char).width;
                    const charAngleWidth = (radiusToUse > 1) ? charWidth / radiusToUse : 0;
                    const charCenterAngle = currentAngle + charAngleWidth / 2;

                    const x = this._middleX + radiusToUse * Math.cos(charCenterAngle);
                    const y = this._middleY + radiusToUse * Math.sin(charCenterAngle);
                    const rotation = charCenterAngle + rotationOffset;

                    this._ctx.save();
                    this._ctx.translate(x, y);
                    this._ctx.rotate(rotation);
                    this._ctx.fillText(char, 0, 0); // Uses font/color set above
                    this._ctx.restore();

                    currentAngle += charAngleWidth;
                }
                // --- End Character Drawing ---
            }
        }


        // --- Outer Labels (Curved, Flipped Bottom) ---
        let outerDims = this._outerDims;
        let defaultOuterLabelRadius = this._inOuter + (this._outOuter - this._inOuter) / 2;
        let numOuterArcs = outerDims.length();
        if (numOuterArcs > 0) {
            let outerArcDegrees = (2 * Math.PI) / numOuterArcs;

            for (let dim = 0; dim < numOuterArcs; dim++) {
                // --- GET ORIGINAL TEXT ---
                let text = outerDims.get(dim).name; // Get original text
                // --- END GET ORIGINAL TEXT ---

                let segmentCenterAngle = ((dim * outerArcDegrees) + (outerArcDegrees / 2)) % (2 * Math.PI);
                if (segmentCenterAngle < 0) segmentCenterAngle += (2 * Math.PI);

                let radiusToUse = defaultOuterLabelRadius;
                let rotationOffset;

                // Determine rotation offset based on angle AND REVERSE TEXT FOR BOTTOM HALF
                if (segmentCenterAngle > 1e-9 && segmentCenterAngle < Math.PI - 1e-9) {
                    // Bottom Half
                    rotationOffset = -Math.PI / 2; // Upright rotation

                     // --- REVERSE THE TEXT STRING (Workaround for SVG export) ---
                    text = text.split('').reverse().join(''); // Reverse the string here
                    // --- END REVERSE THE TEXT STRING ---

                    // Optional radius adjustment (keep if desired)
                    // radiusToUse = defaultOuterLabelRadius - this._textSize * 0.5;
                    // radiusToUse = Math.max(this._inOuter + this._textSize * 0.5, radiusToUse);
                } else {
                    // Top Half
                    rotationOffset = Math.PI / 2; // Tangent rotation
                     // Text remains unchanged for the top half
                }

                // --- Now proceed with calculations using the potentially reversed 'text' ---
                const textWidth = this._ctx.measureText(text).width;
                const totalTextAngle = (radiusToUse > 1) ? textWidth / radiusToUse : 0;
                const textStartAngle = segmentCenterAngle - totalTextAngle / 2;

                // --- Draw each character individually - ALWAYS FORWARDS (using potentially reversed text) ---
                let currentAngle = textStartAngle;
                for (let i = 0; i < text.length; i++) {
                    const char = text[i]; // Get character L->R from the (potentially reversed) string
                    const charWidth = this._ctx.measureText(char).width;
                    const charAngleWidth = (radiusToUse > 1) ? charWidth / radiusToUse : 0;
                    const charCenterAngle = currentAngle + charAngleWidth / 2;

                    const x = this._middleX + radiusToUse * Math.cos(charCenterAngle);
                    const y = this._middleY + radiusToUse * Math.sin(charCenterAngle);
                    const rotation = charCenterAngle + rotationOffset;

                    this._ctx.save();
                    this._ctx.translate(x, y);
                    this._ctx.rotate(rotation);
                    this._ctx.fillText(char, 0, 0); // Uses font/color set above
                    this._ctx.restore();

                    currentAngle += charAngleWidth;
                }
                // --- End Character Drawing ---
            }
        }
    } // End of _drawLabels





// Add this method to the Doughnut / Doughnut_SVG class
setLabelsVisible(visible) {
    this._showLabels = !!visible; // Ensure boolean
    this.update(); // Redraw the doughnut
}

// Example usage from your index.html script:
// myDonut.setLabelsVisible(false); // To hide
// myDonutSVG.setLabelsVisible(false);
// myDonut.setLabelsVisible(true); // To show
// myDonutSVG.setLabelsVisible(true);

    _drawInnerDimensions() {
        this._innerPaths = this._drawDimensions(this._innerDims, this._outInner, this._inInner);
    }

    _drawOuterDimensions() {
        this._outerPaths = this._drawDimensions(this._outerDims, this._outOuter, this._inOuter);
    }

    _drawLimits() {
        // This method is now simplified as the main doughnut band is drawn
        // completely within _drawDoughnut(). The thin limit lines previously
        // drawn here were visually redundant.
    
        // The _inInner circle (at radius 0) is also not drawn as it's invisible.
    
        // You could potentially add other limit lines here in the future if needed,
        // for example, a dashed line at _midDonut:
        /*
        this._ctx.strokeStyle = "gray";
        this._ctx.lineWidth = 1;
        this._ctx.setLineDash([5, 5]); // Example dash pattern
        this._ctx.beginPath();
        this._ctx.arc(this._middleX, this._middleY, this._midDonut, 0, 2 * Math.PI);
        this._ctx.stroke();
        this._ctx.setLineDash([]); // Reset dash pattern
        */
    }

    
    _setupCanvas() {
        this._ctx.font = this._textSize + "px Roboto, Arial, sans-serif";
        this._ctx.fillStyle = "#484848"; // Set new default text color
        this._ctx.textAlign = "center";
        this._ctx.lineWidth = 1;
        this._ctx.strokeStyle = "black";
        this._ctx.shadowBlur = 0;
        this._ctx.shadowOffsetX = 0;
        this._ctx.shadowOffsetY = 0;
        this._ctx.shadowColor = "black";

        // Clear canvas
        this._ctx.beginPath();
        this._ctx.rect(0, 0, this._donutSize, this._donutSize);
        this._ctx.closePath();
        this._ctx.fillStyle = "white";
        this._ctx.fill();
    }

    export() {
        let exportText = this._innerDims.export();
        if (exportText.length > 0) { exportText += "\n"; }
        exportText += this._outerDims.export();
        return exportText;
    }

    _debug(text) {
        let debug = document.getElementById("debug");
        let current = debug.innerHTML;
        debug.innerHTML = current + "<br>\n" + text;
    }

    update() {
        if (this._innerId) {
            document.getElementById(this._innerId).innerHTML = "Inner: " + this._innerDims.string();
        }
        if (this._outerId) {
            document.getElementById(this._outerId).innerHTML = "Outer: " + this._outerDims.string();
        }
        if (this._exportId) {
            document.getElementById(this._exportId).value = this.export();
        }

        this._setupCanvas();
        this._drawDoughnut();
        this._drawOuterDimensions();
        this._drawInnerDimensions();
        this._drawLimits();
        this._drawLabels();
        this._ctx.fillStyle = "black";
        //this._ctx.fillText("Healthcare", this._middleX, this._middleY - this._textSize);
        //this._ctx.fillText("Doughnut", this._middleX, this._middleY + this._textSize)

        if (this._selectedDimInfo) {
            this._ctx.strokeStyle = "#666666";
            this._ctx.stroke(this._selectedDimInfo.path)
        }
    }
import(csv) {
        const lines = csv.trim().split('\n');
        if (lines.length > 0) {
            // Skip the header row
            for (let i = 0; i < lines.length; i++) {
                const values = lines[i].split(',');
                if (values.length === 4) {
                    const dimensionType = values[0].trim();
                    const dimensionName = values[1].trim();
                    const value = values[2].trim(); // Changed from global to value
                    const levelLabel = values[3].trim();
                    this.addDimension(dimensionType, dimensionName, value, levelLabel); // Changed from global to value
                }
            }
        }
    }
}
