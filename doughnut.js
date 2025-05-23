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
        this._showGridlines = false; // <<< ADD THIS LINE (Default to off)
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
    // PASTE THIS ENTIRE CONSTRUCTOR INTO doughnut.js
// REPLACING THE EXISTING constructor FUNCTION

constructor(size, donutScale, textSize, canvasId, divId, infoId, innerId, outerId, exportId) {
    console.log(`CONSTRUCTOR CALLED for ${this.constructor.name} - Canvas ID: ${canvasId}, _inInner will be set to 10`); // Add this line
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

    // **** KEY CHANGE: Set _inInner to a small positive radius ****
    // This is the radius where value=100 will terminate.
    this._inInner = 10; // ADJUST THIS VALUE (e.g., 5, 8, 12, 15) AS NEEDED
    // **** END KEY CHANGE ****

    this._donutRingSize = this._section * this._donutScale;
    let overlapDonut = (this._donutRingSize - this._section) / 2;
    //this._debug("section: " + this._section + " / donutRingSize: " + this._donutRingSize + " / overlap: " + overlapDonut);

    //this._outInner = this._inInner + this._section - overlapDonut; <- original code
    // The calculation from your reverted file seems independent of _inInner's value.
    // If you intended _outInner to be relative to _inInner, adjust this line.
    // For now, using the calculation from your provided reverted file:
    this._outInner = this._section + this._section - overlapDonut;

    this._inDonut = this._outInner;
    this._outDonut = this._inDonut + this._donutRingSize;
    this._midDonut = this._inDonut + (this._outDonut - this._inDonut) / 2;
    this._inOuter = this._outDonut;

    //Modified to be 1.5 X bigger - took away
    this._outOuter = this._inOuter + (this._section - overlapDonut) * 1.5;
    this._extraDonut = this._outOuter + Math.round((25* 1.5) * fudge);   // For the complete overshoot

    this._arcLineWidth = 2;
    // Adjust text radii if needed, based on how _outInner is calculated
    this._textInner = this._outInner + (this._section / 2);
    this._textOuter = this._outOuter - this._textSize;
    this._donutFrosting = "rgb(3,134,173)";
    this._donutFilling = "rgb(126,208,247)";

    // Dimension level values
    this._minDonutLevelRadius = -100;
    this._normalDonutLevelRadius = 100; // Logical range [0, 100]
    this._maxDonutLevelRadius = 150;    // For maximum overshoot!

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
    this._canvas.addEventListener("click", (e) => { this._checkMouse(e, true) }); // Enable click

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
        // Calculate scaled mouse coordinates
        const rect = this._canvas.getBoundingClientRect();
        const scaleX = this._canvas.width / rect.width;
        const scaleY = this._canvas.height / rect.height;
        const canvasX = (e.clientX - rect.left) * scaleX;
        const canvasY = (e.clientY - rect.top) * scaleY;

        let hoverDimInfo = this._checkMouseOver(canvasX, canvasY);
        let currentHoverText = "None";

        if (hoverDimInfo) {
            this._canvas.style.cursor = "crosshair";
            currentHoverText = this._getDimInfoText(hoverDimInfo);
            if (click) {
                if (this._matchingDimInfos(this._selectedDimInfo, hoverDimInfo)) {
                    // Unselect
                    this._selectedDimInfo = null;
                } else {
                    // New selection
                    this._selectedDimInfo = hoverDimInfo;
                }
                this.update(); // Redraw to show selection highlight
            }
        } else {
            this._canvas.style.cursor = "default";
        }

        let currentSelectedText = "None";
        if (this._selectedDimInfo) {
            currentSelectedText = this._getDimInfoText(this._selectedDimInfo);
        }

        // Call the (potentially overridden) _updateInfo method
        // The actual _updateInfo method in this class (for index.html)
        // or the overridden one (for embed.html) will be called.
        this._updateInfo(currentHoverText, currentSelectedText);
    }

    // Modified to accept both hover and selected text
    _updateInfo(currentHoverText, currentSelectedText) {
        if (this._infoId) {
            // This part is primarily for index.html's #dimensionInfo element
            let html = "<p>Hover: " + (currentHoverText || "None") + "</p><p>Select: " + (currentSelectedText || "None") + "</p>";
            document.getElementById(this._infoId).innerHTML = html;
        }
        // For embed.html, the overridden function handles its specific spans.
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
        this._updateInfo("None", "None"); // Pass both nulls
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
            this._updateInfo("None", "None"); // Pass both nulls
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


// PASTE THIS INSIDE Doughnut class (doughnut.js) AND Doughnut_SVG class (doughnut_svg.js)
// (e.g., after the _drawDoughnut method)

_drawGridlines() {
    if (!this._showGridlines) { // Check the flag
        return; // Skip drawing if flag is false
    }

    const gridlineColor = "#cccccc"; // Light grey
    const gridlineWidth = 0.5;       // Thin line
    const dashPattern = [3, 4];      // Dash pattern (3px line, 3px gap)

    this._ctx.save(); // Save current context state
    this._ctx.strokeStyle = gridlineColor;
    this._ctx.lineWidth = gridlineWidth;
    this._ctx.setLineDash(dashPattern); // Apply dash pattern

    const yValues = [25, 50, 75, 100];

    // --- Inner Gridlines ---
    // Range [0, 100] maps to [_outInner, _inInner] (inverted)
    const extScaleInner = (this._outInner - this._inInner) / this._normalDonutLevelRadius;
    yValues.forEach(y => {
        // Calculate radius: Start at _outInner and move inwards
        const radius = this._outInner - (y * extScaleInner);
        if (radius >= this._inInner - 0.1) { // Draw only if radius is >= min inner radius (with tolerance)
            this._ctx.beginPath();
            this._ctx.arc(this._middleX, this._middleY, radius, 0, 2 * Math.PI);
            this._ctx.stroke();
        }
    });

    // --- Outer Gridlines ---
    // Range [0, 100] maps to [_inOuter, _outOuter]
    const extScaleOuter = (this._outOuter - this._inOuter) / this._normalDonutLevelRadius;
     yValues.forEach(y => {
        // Calculate radius: Start at _inOuter and move outwards
        const radius = this._inOuter + (y * extScaleOuter);
         if (radius <= this._outOuter + 0.1) { // Draw only if radius is <= max outer radius (with tolerance)
            this._ctx.beginPath();
            this._ctx.arc(this._middleX, this._middleY, radius, 0, 2 * Math.PI);
            this._ctx.stroke();
        }
    });

    this._ctx.restore(); // Restore original context state
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


// PASTE THIS ENTIRE FUNCTION INTO BOTH doughnut.js AND doughnut_svg.js
// REPLACING THE EXISTING _drawArcsRange FUNCTION

// PASTE THIS HELPER FUNCTION INSIDE BOTH Doughnut and Doughnut_SVG classes
// (Before _drawArcsRange)

/**
 * Finds the intersection point of a line segment and a circle.
 * Assumes the line starts outside or on the circle and points somewhat inwards.
 * @param {number} p1x - Line segment start X
 * @param {number} p1y - Line segment start Y
 * @param {number} p2x - Line segment end X (the point the line is directed towards)
 * @param {number} p2y - Line segment end Y
 * @param {number} radius - Target circle radius
 * @param {number} cx - Circle center X
 * @param {number} cy - Circle center Y
 * @returns {object|null} {x, y} coordinates of the intersection point on the circle, or null if no valid intersection.
 */
_getPointOnLineSegmentAtRadius(p1x, p1y, p2x, p2y, radius, cx, cy) {
    // Vector P1->P2 (direction vector)
    const vx = p2x - p1x;
    const vy = p2y - p1y;
    // Vector C->P1 (from circle center to line start)
    const dx = p1x - cx;
    const dy = p1y - cy;

    const a = vx * vx + vy * vy; // Dot product V.V
    const b = 2 * (dx * vx + dy * vy); // Dot product 2 * D.V
    const c = dx * dx + dy * dy - radius * radius; // Dot product D.D - r^2

    // Quadratic equation: a*t^2 + b*t + c = 0
    const delta = b * b - 4 * a * c; // Discriminant

    if (delta < 0 || a === 0) {
        // No real intersection or line is a point
        // console.warn("No intersection or zero length line", {a,b,c,delta});
        return null;
    }

    // Calculate potential t values (parameter along the line P1 + t*V)
    const sqrtDelta = Math.sqrt(delta);
    const t1 = (-b + sqrtDelta) / (2 * a);
    const t2 = (-b - sqrtDelta) / (2 * a);

    // Find the valid 't' - we want the intersection point that is 'forward' from p1 towards p2
    // and results in a point ON the circle.
    // For lines starting outside and pointing inwards, the smaller positive 't' is usually the first hit.
    let t = null;

    // Check if t1 or t2 represent points *between* p1 and p2 (0 <= t <= 1)
    // or slightly beyond p1 (t near 0) as the first intersection point.
    const tolerance = 1e-6; // Tolerance for floating point comparisons
    const t1Valid = (t1 >= -tolerance); // t1 is forward or very close to p1
    const t2Valid = (t2 >= -tolerance); // t2 is forward or very close to p1

    if (t1Valid && t2Valid) {
        t = Math.min(t1, t2); // Choose the intersection closer to p1
    } else if (t1Valid) {
        t = t1;
    } else if (t2Valid) {
        t = t2;
    }

    // If a valid 't' was found, calculate the intersection point
    if (t !== null) {
        // Clamp t to reasonable bounds if needed, though solving the quadratic should give the exact point
        // t = Math.max(0, Math.min(1, t)); // Optional: Clamp strictly between p1 and p2 if required

        return {
            x: p1x + t * vx,
            y: p1y + t * vy
        };
    }

    // console.warn("No valid 't' found for intersection", {t1, t2});
    return null; // No valid intersection found in the forward direction
}



_drawArcsRange(radiiOut, radiiIn, radiiColour, start, totalDegrees, max, min, calculatedAngularGap) {
    let numTopLevelArcs = radiiOut.length; // Number of dimensions
    if (numTopLevelArcs === 0) return []; // Handle empty case

    let topLevelArcStart = start;
    let topLevelArcDegrees = (numTopLevelArcs > 0) ? totalDegrees / numTopLevelArcs : 0;
    let paths = [];

    const dimensionGap = calculatedAngularGap;
    const symmetricBoundaryOverlap = 0.05; // Keep small symmetric overlap (adjust if needed)
    const innerRadiusTolerance = 0.1; // Tolerance for checking if innerR == _inInner (NO LONGER USED for logic branch)
    const zeroRadiusTolerance = 0.1;

    // Iterate through each top-level dimension
    for (let dimIdx = 0; dimIdx < numTopLevelArcs; dimIdx++) {
        let topLevelArcEnd = topLevelArcStart + topLevelArcDegrees;
        let drawableStart = topLevelArcStart + dimensionGap / 2; // Absolute start for this dim
        let drawableEnd = topLevelArcEnd - dimensionGap / 2;     // Absolute end for this dim
        let drawableTotalDegrees = Math.max(0, drawableEnd - drawableStart);

        // Get data for the current dimension
        let dimOuterRadii = radiiOut[dimIdx];
        let dimInnerRadii = radiiIn[dimIdx];
        let dimColours = radiiColour[dimIdx];
        let numLevels = dimOuterRadii.length;

        paths[dimIdx] = [];

        if (numLevels === 0) {
             topLevelArcStart = topLevelArcEnd;
             continue;
        }

        let levelDrawableDegrees = (numLevels > 0) ? drawableTotalDegrees / numLevels : 0;

        // Iterate through the levels within the current dimension
        for (let levelIdx = 0; levelIdx < numLevels; levelIdx++) {
            let outerR = dimOuterRadii[levelIdx];
            let innerR = dimInnerRadii[levelIdx];
            let colour = dimColours[levelIdx];

            // Calculate THEORETICAL start and end angles
            let currentLevelStart = drawableStart + levelIdx * levelDrawableDegrees;
            let currentLevelEnd = currentLevelStart + levelDrawableDegrees;

            // --- Path2D for Mouse Interaction FIRST ---
            // This path defines the hoverable area for the dimension's level.
            // It uses the THEORETICAL angular boundaries (currentLevelStart, currentLevelEnd)
            // and the full radial extent of the band (min, max parameters).
            // This ensures that even if a wedge isn't visually drawn (e.g., value is 0),
            // the area is still hoverable.
            let hitMinR = Math.max(0, min); // 'min' is this._inInner or this._inOuter
            let hitMaxR = Math.max(hitMinR, max); // 'max' is this._outInner or this._outOuter
            let p = new Path2D();
            if (currentLevelStart < currentLevelEnd - 1e-9) { // Ensure angles are valid for an arc
                p.arc(this._middleX, this._middleY, hitMaxR, currentLevelStart, currentLevelEnd, false);
                p.arc(this._middleX, this._middleY, hitMinR, currentLevelEnd, currentLevelStart, true);
                p.closePath();
            }
            paths[dimIdx][levelIdx] = p;
            // --- End Path2D ---

            // --- Apply SMALL SYMMETRIC Overlap to get DRAW angles ---
            let drawStart = currentLevelStart;
            let drawEnd = currentLevelEnd;
            if (levelIdx > 0) { drawStart -= symmetricBoundaryOverlap / 2; }
            if (levelIdx < numLevels - 1) { drawEnd += symmetricBoundaryOverlap / 2; }
            drawStart = Math.max(drawStart, drawableStart);
            drawEnd = Math.min(drawEnd, drawableEnd);
            // --- End Symmetric Overlap ---

            const safeOuterR = Math.max(0, outerR);
            const safeInnerR = Math.max(0, innerR);

            if (safeOuterR < zeroRadiusTolerance || Math.abs(safeOuterR - safeInnerR) < zeroRadiusTolerance) {
                // The Path2D is already created above, so if the wedge isn't visible,
                // we just skip the drawing part.
                continue;
            }

            // --- Draw the individual level wedge ---
            this._ctx.fillStyle = colour;
            this._ctx.beginPath();

            if (drawStart < drawEnd - 1e-9) {
                // 1. Draw the outer arc (always) - USE ADJUSTED ANGLES
                this._ctx.arc(this._middleX, this._middleY, safeOuterR, drawStart, drawEnd, false);

                const isInnerDimension = (safeOuterR <= this._outInner + innerRadiusTolerance); // Use tolerance for safety

                // 3. Choose drawing logic - UNIFIED FOR INNER DIMENSIONS
                //    (Removed the separate 'Triangle Tip' logic branch)
                if (isInnerDimension && safeInnerR > zeroRadiusTolerance) {
                    // --- *** UNIFIED Hybrid Logic (Handles ALL Inner Wedges > 0 radius) *** ---
                    // Internal boundaries are RADIAL, outer edges use HYBRID intersection.
                    // When safeInnerR is very small (value=100), inner arc appears as near-point.

                    let P_inner_start = null;
                    let P_inner_end = null;
                    let calculationSuccess = true;

                    // Use THEORETICAL angles for tip direction calculation
                    const tipAngle = currentLevelStart + levelDrawableDegrees / 2;
                    const tipX_center = this._middleX + this._inInner * Math.cos(tipAngle);
                    const tipY_center = this._middleY + this._inInner * Math.sin(tipAngle);

                    // Use ADJUSTED angles for outer endpoints
                    const outerStartX = this._middleX + safeOuterR * Math.cos(drawStart);
                    const outerStartY = this._middleY + safeOuterR * Math.sin(drawStart);
                    const outerEndX = this._middleX + safeOuterR * Math.cos(drawEnd);
                    const outerEndY = this._middleY + safeOuterR * Math.sin(drawEnd);

                    // --- Calculate Inner Start Point ---
                    if (levelIdx === 0) { // First level's left edge uses hybrid logic
                        P_inner_start = this._getPointOnLineSegmentAtRadius(outerStartX, outerStartY, tipX_center, tipY_center, safeInnerR, this._middleX, this._middleY);
                    } else { // Internal boundary: Use radial point
                        P_inner_start = {
                            x: this._middleX + safeInnerR * Math.cos(drawStart),
                            y: this._middleY + safeInnerR * Math.sin(drawStart)
                        };
                    }

                    // --- Calculate Inner End Point ---
                    if (levelIdx === numLevels - 1) { // Last level's right edge uses hybrid logic
                        P_inner_end = this._getPointOnLineSegmentAtRadius(outerEndX, outerEndY, tipX_center, tipY_center, safeInnerR, this._middleX, this._middleY);
                    } else { // Internal boundary: Use radial point
                        P_inner_end = {
                            x: this._middleX + safeInnerR * Math.cos(drawEnd),
                            y: this._middleY + safeInnerR * Math.sin(drawEnd)
                        };
                    }

                    // Check if calculations succeeded
                    if (!P_inner_start || !P_inner_end) {
                        calculationSuccess = false;
                        console.warn("Hybrid wedge point calculation failed.", { dimIdx, levelIdx, P_inner_start, P_inner_end });
                    }

                    // --- Draw Path ---
                    if (calculationSuccess) {
                        // Calculate angles from the determined points
                        const innerStartAngle = Math.atan2(P_inner_start.y - this._middleY, P_inner_start.x - this._middleX);
                        const innerEndAngle = Math.atan2(P_inner_end.y - this._middleY, P_inner_end.x - this._middleX);

                        this._ctx.lineTo(P_inner_end.x, P_inner_end.y); // Line from outer end to inner end point

                        // Draw inner arc counter-clockwise
                        if (Math.abs(innerEndAngle - innerStartAngle) > 1e-6) {
                             this._ctx.arc(this._middleX, this._middleY, safeInnerR, innerEndAngle, innerStartAngle, true);
                        } else {
                             this._ctx.lineTo(P_inner_start.x, P_inner_start.y);
                        }
                        // closePath connects P_inner_start back to outerStartX/Y
                    } else {
                        // Fallback: Draw standard arc using ADJUSTED angles
                        this._ctx.arc(this._middleX, this._middleY, safeInnerR, drawEnd, drawStart, true);
                    }
                    // --- *** END UNIFIED Hybrid Logic *** ---

                } else { // Outer Dimension OR Inner wedge hitting radius 0 (should not happen)
                    // --- Standard Arc Logic (for Outer Wedges) --- USE ADJUSTED ANGLES
                    this._ctx.arc(this._middleX, this._middleY, safeInnerR, drawEnd, drawStart, true);
                }

                // 4. Close the path and fill
                this._ctx.closePath();
                this._ctx.fill();
            }
            // --- End Drawing ---
        }
        topLevelArcStart = topLevelArcEnd;
    }
    return paths;
}












_drawArcs(radiiOut, radiiIn, radiiColour, strokeColour, max, min, calculatedAngularGap) {
    // Note: strokeColour passed here is no longer used for individual wedge outlines
    this._ctx.lineWidth = this._arcLineWidth; // May not be needed if only filling
    this._ctx.strokeStyle = strokeColour; // May not be needed if only filling

    // Pass the calculatedAngularGap down to _drawArcsRange
    let paths = this._drawArcsRange(radiiOut, radiiIn, radiiColour, 0, (2 * Math.PI), max, min, calculatedAngularGap);

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
    const whiteColor = "rgb(255, 255, 255)"; // Solid white

    // --- Configuration for Visual Gaps ---
    const desiredInnerVisualGap = 0.4;
    const desiredOuterVisualGap = 8;
    const fallbackAngularGap = 0.04;
    // --- End Configuration ---

    // --- Gradient Configuration ---
    const gradientShift = 0.3; // Position for inner gradient transition
    // --- End Gradient Configuration ---


    if (dims.length() > 0) {
        let inRadii = [];
        let outRadii = [];
        let colRadii = [];
        // Scaling factor: maps logical range [0, 100] to physical range [extMin, extMax]
        let extScale = (extMax - extMin) / this._normalDonutLevelRadius;
        let intScale = ((this._outDonut - this._inDonut) / 2) / this._normalDonutLevelRadius;

        let type = null;
        let minRadiusForHitDetect = 0, maxRadiusForHitDetect = 0;
        let angularGapForThisSet = fallbackAngularGap; // Initialize with fallback

        // Determine type, hit detection boundaries, and CALCULATE ANGULAR GAP
        if (extMax > this._outDonut) { // Corresponds to OUTER dimensions
            type = OUTER;
            minRadiusForHitDetect = this._inOuter;
            maxRadiusForHitDetect = this._outOuter;
            const relevantRadius = this._inOuter;
            if (relevantRadius > 1 && dims.length() > 1) {
                angularGapForThisSet = desiredOuterVisualGap / relevantRadius;
            } else if (dims.length() <= 1) {
                angularGapForThisSet = 0;
            } else {
                angularGapForThisSet = fallbackAngularGap;
            }

        } else { // Corresponds to INNER dimensions
            type = INNER;
            minRadiusForHitDetect = this._inInner;
            maxRadiusForHitDetect = this._outInner;
            const relevantRadius = this._inInner;
            if (relevantRadius > 1 && dims.length() > 1) {
                angularGapForThisSet = desiredInnerVisualGap / relevantRadius;
            } else if (dims.length() <= 1) {
                 angularGapForThisSet = 0;
            } else {
                angularGapForThisSet = fallbackAngularGap;
            }
        }

        // --- Limit the calculated angular gap ---
        const maxAllowedGapFraction = 0.5;
        const anglePerDimension = (dims.length() > 0) ? (2 * Math.PI) / dims.length() : (2 * Math.PI);
        angularGapForThisSet = Math.min(angularGapForThisSet, anglePerDimension * maxAllowedGapFraction);
        angularGapForThisSet = Math.max(0, angularGapForThisSet);
        // --- End Gap Limiting ---


        for (let dim = 0; dim < dims.length(); dim++) {
            let levels = dims.get(dim).levels;
            let inArcs = [];
            let outArcs = [];
            let cols = [];
            for (let lvl = 0; lvl < levels.length; lvl++) {
                let val = levels[lvl].value;
                let outer = 0; // Outer radius for drawing the wedge
                let inner = 0; // Inner radius for drawing the wedge
                let col = this._grd; // Default gradient (set in _setupCanvas)

                if (this._isNotNumber(val)) {
                    // --- Handle Invalid Data: Apply Grey Gradient ---
                    inner = extMin; // Use the band's min radius
                    outer = extMax; // Use the band's max radius

                    if (type == INNER) {
                        // *** MODIFIED INNER NaN GRADIENT: Grey to White ***
                        col = this._ctx.createRadialGradient(this._middleX, this._middleY, inner, this._middleX, this._middleY, outer);
                        // Start white near the center (inner radius)
                        col.addColorStop(0, whiteColor);
                        // Transition to grey at the outer edge (_outInner)
                        col.addColorStop(1, greyColor);
                        // *** END MODIFICATION ***
                    } else { // type == OUTER (Keep original Grey to Transparent)
                        col = this._ctx.createRadialGradient(this._middleX, this._middleY, inner, this._middleX, this._middleY, outer);
                        col.addColorStop(0, greyColor);
                        col.addColorStop(1.0 - gradientShift, transparentGreyColor);
                    }
                } else {
                    // --- Handle Valid Data (including negative overshoot) ---
                    if (type == INNER) {
                        if (val < 0) {
                            inner = extMax; // Starts at _outInner
                            outer = extMax + (val * intScale); // Moves inwards
                            col = whiteColor; // Solid white for overshoot
                        } else {
                            let scaledVal = Math.min(val, this._normalDonutLevelRadius); // Cap at 100
                            inner = extMin + ((this._normalDonutLevelRadius - scaledVal) * extScale);
                            outer = extMax; // Always _outInner
                            // col remains this._grd (pink gradient)
                        }
                    } else { // type == OUTER
                        if (val < 0) {
                            inner = extMin + (val * intScale); // Moves inwards from _inOuter
                            outer = extMin; // Ends at _inOuter
                            col = whiteColor; // Solid white for overshoot
                        } else {
                            inner = extMin; // Starts at _inOuter
                            let potentialOuter = extMin + (val * extScale);
                            outer = Math.min(potentialOuter, this._middleX); // Cap radius at center
                            // col remains this._grd (pink gradient)
                        }
                    }
                }
                // Ensure radii are not negative
                inArcs.push(Math.max(0, inner));
                outArcs.push(Math.max(0, outer));
                cols.push(col);
            }
            inRadii[dim] = inArcs;
            outRadii[dim] = outArcs;
            colRadii[dim] = cols;
        }

        // Call _drawArcs, passing the CALCULATED angularGapForThisSet
        paths = this._drawArcs(outRadii, inRadii, colRadii, "white", maxRadiusForHitDetect, minRadiusForHitDetect, angularGapForThisSet);
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
        this._ctx.font = fontSize + "px Arial, sans-serif";
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


    // PASTE THIS ENTIRE FUNCTION INTO doughnut.js
// REPLACING THE EXISTING _drawLabels FUNCTION

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

    // **** ADD Adjustment Factor for Canvas Rendering ****
    // This value nudges the text slightly inwards (downwards visually)
    // Adjust this multiplier (e.g., 0.1, 0.15, 0.2) if needed.
    const canvasVerticalOffset = this._textSize * 0.15;
    // **** END Adjustment Factor ****

    // 1. "Sustainable quality care for all" - Bottom center
    const radiusLightBlueMid = (radiusInnerBandEdge + radiusLightBlueEdge) / 2;
    const angleBottomCenter = Math.PI / 2;
    let sustainableText = "Sustainable quality care for all";
    sustainableText = sustainableText.split('').reverse().join(''); // Keep reversal for bottom
    this._drawCurvedText(
        sustainableText,
        radiusLightBlueMid, // No offset needed for this one usually
        angleBottomCenter,
        staticLabelColor,
        this._textSize * 1.1
    );

    // 2. "HEALTHCARE FOUNDATION" - Top center (Apply Offset)
    const radiusInnerDarkBlueMid = (radiusHoleEdge + radiusInnerBandEdge) / 2 - canvasVerticalOffset/2; // Subtract offset
    const angleTopCenter = 3 * Math.PI / 2;
    this._drawCurvedText(
        "HEALTHCARE FOUNDATION",
        radiusInnerDarkBlueMid, // Use adjusted radius
        angleTopCenter,
        staticLabelColor,
        smallerTextSize
    );

    // 3. "ECOLOGICAL CEILING" - Top center (Apply Offset)
    const radiusOuterDarkBlueMid = (radiusLightBlueEdge + radiusOuterBandEdge) / 2 - canvasVerticalOffset/2; // Subtract offset
    // Use same angleTopCenter
    this._drawCurvedText(
        "ECOLOGICAL CEILING",
        radiusOuterDarkBlueMid, // Use adjusted radius
        angleTopCenter,
        staticLabelColor,
        smallerTextSize
    );
    // --- End Static Corridor Labels ---

    // Reset context defaults specifically for dynamic labels
    this._ctx.font = this._textSize + "px Arial, sans-serif";
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
            let text = innerDims.get(dim).name;
            let segmentCenterAngle = ((dim * innerArcDegrees) + (innerArcDegrees / 2)) % (2 * Math.PI);
            if (segmentCenterAngle < 0) segmentCenterAngle += (2 * Math.PI);

            let radiusToUse = defaultInnerLabelRadius;
            let rotationOffset;

            if (segmentCenterAngle > 1e-9 && segmentCenterAngle < Math.PI - 1e-9) {
                rotationOffset = -Math.PI / 2;
                text = text.split('').reverse().join('');
            } else {
                rotationOffset = Math.PI / 2;
            }

            const textWidth = this._ctx.measureText(text).width;
            const totalTextAngle = (radiusToUse > 1) ? textWidth / radiusToUse : 0;
            const textStartAngle = segmentCenterAngle - totalTextAngle / 2;

            let currentAngle = textStartAngle;
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                const charWidth = this._ctx.measureText(char).width;
                const charAngleWidth = (radiusToUse > 1) ? charWidth / radiusToUse : 0;
                const charCenterAngle = currentAngle + charAngleWidth / 2;

                const x = this._middleX + radiusToUse * Math.cos(charCenterAngle);
                const y = this._middleY + radiusToUse * Math.sin(charCenterAngle);
                const rotation = charCenterAngle + rotationOffset;

                this._ctx.save();
                this._ctx.translate(x, y);
                this._ctx.rotate(rotation);
                this._ctx.fillText(char, 0, 0);
                this._ctx.restore();

                currentAngle += charAngleWidth;
            }
        }
    }


    // --- Outer Labels (Curved, Flipped Bottom) ---
    let outerDims = this._outerDims;
    let defaultOuterLabelRadius = this._inOuter + (this._outOuter - this._inOuter) / 2;
    let numOuterArcs = outerDims.length();
    if (numOuterArcs > 0) {
        let outerArcDegrees = (2 * Math.PI) / numOuterArcs;

        for (let dim = 0; dim < numOuterArcs; dim++) {
            let text = outerDims.get(dim).name;
            let segmentCenterAngle = ((dim * outerArcDegrees) + (outerArcDegrees / 2)) % (2 * Math.PI);
            if (segmentCenterAngle < 0) segmentCenterAngle += (2 * Math.PI);

            let radiusToUse = defaultOuterLabelRadius;
            let rotationOffset;

            if (segmentCenterAngle > 1e-9 && segmentCenterAngle < Math.PI - 1e-9) {
                rotationOffset = -Math.PI / 2;
                text = text.split('').reverse().join('');
            } else {
                rotationOffset = Math.PI / 2;
            }

            const textWidth = this._ctx.measureText(text).width;
            const totalTextAngle = (radiusToUse > 1) ? textWidth / radiusToUse : 0;
            const textStartAngle = segmentCenterAngle - totalTextAngle / 2;

            let currentAngle = textStartAngle;
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                const charWidth = this._ctx.measureText(char).width;
                const charAngleWidth = (radiusToUse > 1) ? charWidth / radiusToUse : 0;
                const charCenterAngle = currentAngle + charAngleWidth / 2;

                const x = this._middleX + radiusToUse * Math.cos(charCenterAngle);
                const y = this._middleY + radiusToUse * Math.sin(charCenterAngle);
                const rotation = charCenterAngle + rotationOffset;

                this._ctx.save();
                this._ctx.translate(x, y);
                this._ctx.rotate(rotation);
                this._ctx.fillText(char, 0, 0);
                this._ctx.restore();

                currentAngle += charAngleWidth;
            }
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

setGridlinesVisible(visible) {
    this._showGridlines = !!visible; // Ensure boolean
    this.update(); // Redraw the doughnut
}

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
        this._ctx.font = this._textSize + "px Arial, sans-serif";
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

    // REPLACE the existing update() method in BOTH doughnut.js and doughnut_svg.js

update() {
    // Update HTML elements (Keep this part)
    if (this._innerId) {
        document.getElementById(this._innerId).innerHTML = "Inner: " + this._innerDims.string();
    }
    if (this._outerId) {
        document.getElementById(this._outerId).innerHTML = "Outer: " + this._outerDims.string();
    }
    if (this._exportId) {
        document.getElementById(this._exportId).value = this.export();
    }

    // Drawing sequence
    this._setupCanvas();        // 1. Prepare canvas
    this._drawDoughnut();       // 2. Draw base doughnut rings
    this._drawGridlines();      // 3. <<< ADD THIS CALL to draw gridlines behind wedges
    this._drawOuterDimensions();// 4. Draw outer wedges
    this._drawInnerDimensions();// 5. Draw inner wedges
    this._drawLimits();         // 6. Draw limit lines (if any)
    this._drawLabels();         // 7. Draw text labels

    // Draw center text (Keep this part)
    this._ctx.fillStyle = "black";
    //this._ctx.fillText("Healthcare", this._middleX, this._middleY - this._textSize);
    //this._ctx.fillText("Doughnut", this._middleX, this._middleY + this._textSize)

    // Highlight selected dimension (Keep this part)
    if (this._selectedDimInfo) {
        // Use a different color/style for selection if needed
        this._ctx.strokeStyle = "#fb8a98"; // New selection color
        this._ctx.lineWidth = 1.5;
        this._ctx.stroke(this._selectedDimInfo.path);
        this._ctx.lineWidth = 1; // Reset line width
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
