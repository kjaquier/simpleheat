/*
 (c) 2014, Vladimir Agafonkin
 simpleheat, a tiny JavaScript library for drawing heatmaps with Canvas
 https://github.com/mourner/simpleheat
*/

(function () { 'use strict';

function Matrix(w, h, array) {
    this.h = w;
    this.w = h;
    this.array = array;

    this.get = function(x, y) {
        return this.array[this.getIndex(x, y)];
    };
    this.set = function(x, y, value) {
        this.array[this.getIndex(x, y)] = value;
    };
    this.getIndex = function(x, y) {
        return this.w * y + x;
    };
    this.getCoords = function (idx) {
        return [~~(idx / this.w), idx % this.w];
    };
    this.length = function() {
        return this.w * this.h;
    };
}

function simpleheat(canvas) {
    // jshint newcap: false, validthis: true
    if (!(this instanceof simpleheat)) { return new simpleheat(canvas); }

    this._canvas = canvas = typeof canvas === 'string' ? document.getElementById(canvas) : canvas;

    this._ctx = canvas.getContext('2d');
    this._width = canvas.width;
    this._height = canvas.height;
    this._r = 1;

    this._max = 1;
    this._data = [];
    this._drawFunc = this.drawPoints;
    this._addPointFunc = this.pushPoint;
}

simpleheat.prototype = {

    defaultRadius: 25,

    defaultGradient: {
        0.4: 'blue',
        0.6: 'cyan',
        0.7: 'lime',
        0.8: 'yellow',
        1.0: 'red'
    },

    dataMatrix: function (w, h, dataMatrix) {
        this._dataMatrix = new Matrix(w, h, dataMatrix);
        this._drawFunc = this.drawMatrix;
        this._addPointFunc = this.addPointInMatrix;
        return this;
    },

    data: function (data) {
        this._data = data;
        this._drawFunc = this.drawPoints;
        this._addPointFunc = this.pushPoint;
        return this;
    },

    max: function (max) {
        this._max = max;
        return this;
    },

    add: function (point) {
        return this._addPointFunc(point);
    },

    pushPoint: function(point) {
        this._data.push(point);
        return this;
    },

    addPointInMatrix: function(point) {
        var mat = this._dataMatrix;
        var x = ~~((point[0] / this._width) * mat.w);
        var y = ~~((point[1] / this._height) * mat.h);
        mat.set(x, y, Math.min(mat.get(x, y) + point[2], this._max));
        return this;
    },

    clear: function () {
        this._data = [];
        return this;
    },

    pointStyle: function(attrs) {
        var blur = attrs.blur || 0;
        var radius = attrs.radius || (this._dataMatrix === undefined ? 1 : this._getAutoRadius());

        // create a grayscale blurred circle image that we'll use for drawing points
        var circle = this._circle = document.createElement('canvas'),
            ctx = circle.getContext('2d'),
            r2 = this._r = radius + blur;

        circle.width = circle.height = r2 * 2;

        if (blur > 0) {
            var offset = 200;
            ctx.shadowOffsetX = ctx.shadowOffsetY = offset;
            ctx.shadowBlur = blur;
            ctx.shadowColor = 'black';
        } else {
            var offset = 0;
        }

        ctx.beginPath();
        ctx.arc(r2 - offset, r2 - offset, radius, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.fill();

        return this;
    },

    _getAutoRadius: function() {
        if (this._dataMatrix === undefined) {
            return this;
        }
        var wRadius = ~~(this._width / this._dataMatrix.w);
        var hRadius = ~~(this._height / this._dataMatrix.h);
        return Math.min(wRadius, hRadius) / 2;
    },

    gradient: function (grad) {
        // create a 256x1 gradient that we'll use to turn a grayscale heatmap into a colored one
        var canvas = document.createElement('canvas'),
            ctx = canvas.getContext('2d'),
            gradient = ctx.createLinearGradient(0, 0, 0, 256);

        canvas.width = 1;
        canvas.height = 256;

        for (var i in grad) {
            gradient.addColorStop(i, grad[i]);
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1, 256);

        this._grad = ctx.getImageData(0, 0, 1, 256).data;

        return this;
    },

    draw: function (minOpacity) {
        return this._drawFunc(minOpacity);
    },

    drawMatrix: function (minOpacity) {
        if (!this._circle) {
            this.pointStyle({ radius: this.defaultRadius });
        }
        if (!this._grad) {
            this.gradient(this.defaultGradient);
        }

        var ctx = this._ctx;

        ctx.clearRect(0, 0, this._width, this._height);

        // draw a grayscale heatmap by putting a blurred circle at each data point
        var mat = this._dataMatrix;
        var data = mat.array;
        for (var i = 0, len = mat.length(), p, px, py; i < len; i++) {
            p = data[i];
            // get (x,y) coords from index i and normalize them in
            // the actual coord space of the canvas
            py = mat.getCoords(i)[0];
            px = mat.getCoords(i)[1];

            py = ~~((py / mat.h) * this._height);
            px = ~~((px / mat.w) * this._width);

            ctx.globalAlpha = Math.max(p / this._max, minOpacity === undefined ? 0.05 : minOpacity);
            ctx.drawImage(this._circle, px - this._r, py - this._r);
        }
        // colorize the heatmap, using opacity value of each pixel to get the right color from our gradient
        var colored = ctx.getImageData(0, 0, this._width, this._height);
        this._colorize(colored.data, this._grad);
        ctx.putImageData(colored, 0, 0);

        return this;
    },

    drawPoints: function (minOpacity) {
        if (!this._circle) {
            this.pointStyle({ radius: this.defaultRadius });
        }
        if (!this._grad) {
            this.gradient(this.defaultGradient);
        }

        var ctx = this._ctx;

        ctx.clearRect(0, 0, this._width, this._height);

        // draw a grayscale heatmap by putting a blurred circle at each data point
        for (var i = 0, len = this._data.length, p; i < len; i++) {
            p = this._data[i];

            ctx.globalAlpha = Math.max(p[2] / this._max, minOpacity === undefined ? 0.05 : minOpacity);
            ctx.drawImage(this._circle, p[0] - this._r, p[1] - this._r);
        }

        // colorize the heatmap, using opacity value of each pixel to get the right color from our gradient
        var colored = ctx.getImageData(0, 0, this._width, this._height);
        this._colorize(colored.data, this._grad);
        ctx.putImageData(colored, 0, 0);

        return this;
    },

    _colorize: function (pixels, gradient) {
        for (var i = 3, len = pixels.length, j; i < len; i += 4) {
            j = pixels[i] * 4; // get gradient color from opacity value

            if (j) {
                pixels[i - 3] = gradient[j];
                pixels[i - 2] = gradient[j + 1];
                pixels[i - 1] = gradient[j + 2];
            }
        }
    }
};

window.simpleheat = simpleheat;

})();
