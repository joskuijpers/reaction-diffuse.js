/// Library

function elt(name, attrs, ...children) {
    if(attrs == undefined) attrs = {}

    let dom = document.createElement(name)
    for (let attr of Object.keys(attrs)) {
        dom.setAttribute(attr, attrs[attr])
    }
    for (let child of children) {
        dom.appendChild(child)
    }
    return dom;
}


/// Reacton-Diffustion state
class State {
    constructor(width, height) {
        this.width = width
        this.height = height

        this.pixels = new Array(width * height).fill(0) // Start color

        // Seeding with A = 1, B = 0
        this.dataA = new Array(width * height).fill(1) // Start value of A
        this.dataB = new Array(width * height).fill(0) // Start value of B
    }

    static empty(width, height, startClusterSize) {
        const state = new State(width, height)

        // Set small area B=1
        state:seedAtCenter(startClusterSize)
    }

    seedAtCenter(clusterSize) {
        const halfWidth = Math.ceil(this.width / 2)
        const halfHeight = Math.ceil(this.height / 2)
        const halfClusterSize = Math.ceil(clusterSize / 2)

        // In the center
        for(let u = halfWidth - halfClusterSize; u < halfWidth + halfClusterSize; u++) {
            for(let v = halfHeight - halfClusterSize; v < halfHeight + halfClusterSize; v++) {
                this.setPoint(u, v, 0, 1)
            }
        }
    }

    setPoint(u, v, a, b) {
        const pos = u + v * this.width
        this.dataA[pos] = a
        this.dataB[pos] = b
    }

    // Get a point
    getPoint(u, v) {
        // Wrapping
        if (u < 0)
            u += this.width
        else if (u > this.width - 1)
            u -= this.width
        if (v < 0)
            v += this.height
        else if (v > this.height - 1)
            v -= this.height

        // 0,0 at edges
        // if(u < 0 || u > this.width - 1 || v < 0 || v > this.height - 1) {
        //     return [0, 0]
        // }

        const pos = u + v * this.width
        return [this.dataA[pos], this.dataB[pos]]
    }

    getPointV(u, v, t) {
        return this.getPoint(u, v)[t]
    }

    pixel(x, y) {
        return this.pixels[x + y * this.width]
    }

    // Update the pixels based on AB
    updatePixels() {
        for(let u = 0; u < this.width; u++) {
            for(let v = 0; v < this.height; v++) {
                let [a, b] = this.getPoint(u, v)
                // let norm = Math.sqrt(a * a + b * b)
                let color = 'rgb(' + a * 255 + ', ' + b * 255 + ', 0)'
                this.pixels[u + v * this.width] = color
            }
        }
        return this.pixels
    }
}

/// Picture, mainly drawing of the state
class Picture {
    constructor() {
        this.dom = elt("canvas")
    }

    drawPicture(state, scale) {
        this.dom.width = state.width * scale
        this.dom.height = state.height * scale
        let cx = this.dom.getContext("2d")

        for (let y = 0; y < state.height; y++) {
            for (let x = 0; x < state.width; x++) {
                cx.fillStyle = state.pixel(x, y)
                cx.fillRect(x * scale, y * scale, scale, scale)
            }
        }
    }
}

/// Generator configuration
class Config {
    constructor() {
        this.Da = 1.0
        this.Db = 0.5
        this.f = 0.055
        this.k = 0.062
        this.dt = 1.0
    }
}

class App {
    constructor(state, config) {
        this.state = state
        this.config = config

        this.canvas = new Picture(state)

        this.dom = elt("div", {}, this.canvas.dom)

        this.t = 0
    }

    // Draw update
    draw() {
        this.canvas.drawPicture(this.state, 10)
    }

    // Update
    update(dt) {
        this.updateAll()

        this.t = this.t - dt
        if (this.t <= 0) {
            this.t = 1000

            this.state.updatePixels()
            this.draw()
        }
    }


    updateAll() {
        for(let u = 0; u < this.state.width; u++) {
            for(let v = 0; v < this.state.height; v++) {
                this.updateValue(u, v, 1)
            }
        }
    }

    updateValue(u, v, dt) {
        let [a, b] = this.state.getPoint(u, v)

        const la = this.laplace_int2(u, v, this.state, 0)
        const lb = this.laplace_int2(u, v, this.state, 1)
        // let [la, lb] = this.laplace(u, v)

        let an = a + (this.config.Da * la - a * b * b + this.config.f * (1 - a)) * dt * this.config.dt
        let bn = b + (this.config.Db * lb + a * b * b - (this.config.k + this.config.f) * b) * dt * this.config.dt

        this.state.setPoint(u, v, an, bn)
    }

    // 3x3 convolution with center weight -1, adjacent neighbors 0.2 and diagonals 0.05
    laplace(u, v) {
        // let a = [[0, 0, 0],[0, 0, 0],[0, 0, 0]]
        // let b = [[0, 0, 0],[0, 0, 0],[0, 0, 0]]

        // for(let x = 0; x < 3; x++) {
        //     for(let y = 0; y < 3; y++) {
        //         let [p, q] = this.state.getPoint(u + (x - 1), v + (y - 1))
        //         a[x][y] = p
        //         b[x][y] = q
        //     }
        // }

        // return [this.laplace_int(a), this.laplace_int(b)]
        return [this.laplace_int2(u, v, this.state, 0), this.laplace_int2(u, v, this.state, 1)]
    }

    // Single instance laplace
    laplace_int(data) {
        const Wc = -1.00
        const Wn = 0.20
        const Wd = 0.05

        return 0
            + data[0][0] * Wd
            + data[0][1] * Wn
            + data[0][2] * Wd

            + data[1][0] * Wn
            + data[1][1] * Wc
            + data[1][2] * Wn

            + data[2][0] * Wd
            + data[2][1] * Wn
            + data[2][2] * Wd
    }

    laplace_int2(u, v, state, t) {
        const Wc = -1.00
        const Wn = 0.20
        const Wd = 0.05

        return 0
            + state.getPointV(u - 1, v - 1, t) * Wd
            + state.getPointV(u - 1, v, t) * Wn
            + state.getPointV(u - 1, v + 1, t) * Wd

            + state.getPointV(u, v - 1, t) * Wn
            + state.getPointV(u, v, t) * Wc
            + state.getPointV(u, v + 1, t) * Wn

            + state.getPointV(u + 1, v - 1, t) * Wd
            + state.getPointV(u + 1, v, t) * Wn
            + state.getPointV(u + 1, v + 1, t) * Wd
    }

}

function start() {
    const state = new State(50, 50)
    state.seedAtCenter(2)

    const config = new Config()

    let app = new App(state, config)

    runAnimation(dt => app.update(dt))

    return app.dom
}

function runAnimation(frameFunc) {
    let lastTime = null
    function frame(time) {
        if (lastTime != null) {
            let timeStep = Math.min(time - lastTime, 100)
            if (frameFunc(timeStep) === false) {
                return
            }
        }
        lastTime = time
        requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
}
