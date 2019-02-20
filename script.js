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

    seedAtCenter(clusterSize) {
        this.seedAtPoint(self.width / 2, self.height / 2, clusterSize)
    }

    seedAtPoint(u, v, clusterSize) {
        const halfWidth = Math.ceil(this.width / 2)
        const halfHeight = Math.ceil(this.height / 2)
        const halfClusterSize = Math.ceil(clusterSize / 2)

        // In the center
        for(let x = u - halfClusterSize; x < u + halfClusterSize; x++) {
            for(let y = v - halfClusterSize; y < v + halfClusterSize; y++) {
                this.setPoint(x, y, 0, 1)
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

        // if(u < 0 || u > this.width - 1 || v < 0 || v > this.height - 1) {
        //     return [1, 0]
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
                let color = 'rgb(' + Math.floor(a * 255) + ', 0, ' + Math.floor(b * 255) + ')'
                // let color
                // if (a > b)
                //     color = 'rgb(0, 0, 0)'
                // else
                //     color = 'rgb(255, 255, 255)'

                this.pixels[u + v * this.width] = color
            }
        }
        return this.pixels
    }

    copy() {
        let n = new State(this.width, this.height)
        return n
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
        this.Db = 0.4
        this.f = 0.04
        this.k = 0.06
        this.dt = 1.0

        // Flower thing
        // this.f = 0.06
        // this.k = 0.06
        // Different rounder flower
        // this.f = 0.05
        // this.k = 0.06
    }
}

class App {
    constructor(state, config) {
        this.state = state
        this.next = state.copy()
        this.config = config

        this.canvas = new Picture(state)

        this.dom = elt("div", {}, this.canvas.dom)

        this.t = 0
    }

    // Draw update
    draw() {
        this.canvas.drawPicture(this.state, 1)
    }

    // Update
    update(dt) {
        for (let i = 0; i < 10; i++) {
            this.updateAll()
            this.swap()
        }

        this.state.updatePixels()
        this.draw()
    }

    swap() {
        let temp = this.state
        this.state = this.next
        this.next = temp
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

        const la = this.laplace(u, v, this.state, 0)
        const lb = this.laplace(u, v, this.state, 1)

        // Different values depending on position
        // let k = (u / this.state.width) * (0.07 - 0.045) + 0.045
        // let k = 0.06
        // let f = 0.05
        // let f = (v / this.state.width) * (0.1 - 0.01) + 0.01
        let f = this.config.f
        let k = this.config.k

        let an = a + (this.config.Da * la - a * b * b + f * (1 - a)) * dt * this.config.dt
        let bn = b + (this.config.Db * lb + a * b * b - (k + f) * b) * dt * this.config.dt

        this.next.setPoint(u, v, an, bn)
    }

    laplace(u, v, state, t) {
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
    let size = 400
    const state = new State(size, size)
    state.seedAtPoint(size/2, size/2, 10)

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
