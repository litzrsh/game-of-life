const renderScript = `
const FRAME_RATE = 30;
var t_prev = null;

var width = 0;
var height = 0;
var ctx = null;
var grid = null;
var datas = [];

onmessage = function (e) {
  if (e.data.datas) {
    datas = e.data.datas;
  }
  if (e.data.canvas) {
    const canvas = e.data.canvas;
    width = canvas.width;
    height = canvas.height;
    ctx = canvas.getContext("2d");
    requestAnimationFrame(render);
  }
}

async function render(t) {
  if (t_prev === null) {
    t_prev = t;
    requestAnimationFrame(render);
    return;
  } else if (1000 / (t - t_prev) > FRAME_RATE) {
    requestAnimationFrame(render);
    return;
  }
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  for (var i = 0; i < datas.length; i++) {
    const data = datas[i];
    ctx.fillStyle = "#000";
    ctx.fillRect(data.x * 10, data.y * 10, 10, 10);
  }
  for (var i = 0; i < width; i+=10) {
    for (var j = 0; j < height; j+=10) {
      ctx.strokeStyle = "#c3c3c3";
      ctx.strokeRect(i, j, 10, 10);
    }
  }
  requestAnimationFrame(render);
}
`;

class Game {
  width;
  height;
  wrap;
  canvas;
  worker;
  started = false;
  interval = null;
  datas = [];
  map = {};

  constructor(el, width = 100, height = 100) {
    this.width = width;
    this.height = height;
    if (!el) throw "Required parameter el is empty";
    if (typeof el === "string") {
      if (!el.startsWith("#")) el = "#" + el;
      this.wrap = document.querySelector(el);
      if (!this.wrap) throw `Failed to find element ${el}`;
    } else if (el instanceof HTMLDivElement) {
      this.wrap = el;
    } else {
      throw "Invalid element type";
    }
    this.wrap.classList.add("game-of-life");
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.width * 10;
    this.canvas.height = this.height * 10;
    this.wrap.appendChild(this.canvas);

    this.datas = new Array(this.height);
    for (var i = 0; i < this.height; i++) {
      this.datas[i] = new Array(this.width);
      this.datas[i].fill(0);
    }

    const offscreen = this.canvas.transferControlToOffscreen();
    const blobURL = URL.createObjectURL(
      new Blob([renderScript], { type: "text/javascript" })
    );
    this.worker = new Worker(blobURL, { name: "GOL_WORKER" });
    this.worker.postMessage(
      {
        canvas: offscreen,
        datas: [],
      },
      [offscreen]
    );

    this.onWindowResizeEventListener();
    window.addEventListener("resize", this.onWindowResizeEventListener);

    this.canvas.addEventListener("click", (e) => {
      if (this.started) return;
      const { x, y, width, height } = e.target.getBoundingClientRect();
      const dx = Math.floor(((e.x - x) * this.width) / width);
      const dy = Math.floor(((e.y - y) * this.height) / height);
      if (this.datas[dy][dx] === 1) {
        this.datas[dy][dx] = 0;
        delete this.map[`${dx}_${dy}`];
      } else if (this.datas[dy][dx] === 0) {
        this.datas[dy][dx] = 1;
        this.map[`${dx}_${dy}`] = { x: dx, y: dy, v: 1 };
      }
      this.worker.postMessage({ datas: Object.values(this.map) });
    });
  }

  random() {
    if (this.started) return;
    this.datas = new Array(this.height);
    for (var i = 0; i < this.height; i++) {
      this.datas[i] = new Array(this.width);
      this.datas[i].fill(0);
    }
    this.map = {};
    var size = Math.floor(Math.random() * this.width * this.height);
    for (var i = 0; i < size; i++) {
      var dx = Math.floor(Math.random() * this.width);
      var dy = Math.floor(Math.random() * this.height);
      this.datas[dy][dx] = 1;
      this.map[`${dx}_${dy}`] = { x: dx, y: dy, v: 1 };
    }
    this.worker.postMessage({ datas: Object.values(this.map) });
  }

  start() {
    this.started = true;
    this.interval = setInterval(() => {
      for (var i = 0; i < this.height; i++) {
        for (var j = 0; j < this.width; j++) {
          const n = __get_neighberhoods.apply(this, [j, i]);
          if (this.datas[i][j] === 0 && n === 3) {
            this.map[`${j}_${i}`] = { x: j, y: i, v: 1 };
          } else if (this.datas[i][j] === 1 && (n < 2 || n > 3)) {
            this.map[`${j}_${i}`].v = 0;
          }
        }
      }
      for (var member in this.map) {
        var item = this.map[member];
        if (item.v === 0) {
          this.datas[item.y][item.x] = 0;
          delete this.map[member];
        } else if (item.v === 1) {
          this.datas[item.y][item.x] = 1;
        }
      }
      this.worker.postMessage({ datas: Object.values(this.map) });
    }, 100);
  }

  dispose() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    window.removeEventListener("resize", this.onWindowResizeEventListener);
    this.interval = null;
    this.worker.terminate();
    this.canvas.remove();
    this.wrap.classList.remove("game-of-life");
    this.wrap.innerHTML = "";
  }

  onWindowResizeEventListener() {
    __on_window_resize.apply(this);
  }
}

function __on_window_resize() {
  const { width, height } = this.wrap.getBoundingClientRect();
  const r = this.width / this.height;
  const sizes = [
    [width, width / r],
    [height * r, height],
  ];
  if (sizes[0][1] < height) {
    this.canvas.style.width = `${sizes[0][0]}px`;
    this.canvas.style.height = `${sizes[0][1]}px`;
  } else if (sizes[1][0] < width) {
    this.canvas.style.width = `${sizes[1][0]}px`;
    this.canvas.style.height = `${sizes[1][1]}px`;
  }
}

function __get_neighberhoods(x, y) {
  const ds = [
    [1, 1],
    [1, 0],
    [0, 1],
    [-1, -1],
    [-1, 0],
    [0, -1],
    [1, -1],
    [-1, 1],
  ];
  var array = [];
  ds.forEach((d) => {
    var dx = x + d[0];
    var dy = y + d[1];
    if (dx > 0 && dx < this.width && dy > 0 && dy < this.height) {
      array.push(this.datas[dy][dx]);
    }
  });
  return array.length === 0 ? 0 : array.reduce((p, v) => p + v);
}
