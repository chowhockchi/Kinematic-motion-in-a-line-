const DOM = {
    inputType: document.getElementById('inputType'),
    eqInput: document.getElementById('eqInput'),
    s0Group: document.getElementById('s0-group'),
    v0Group: document.getElementById('v0-group'),
    s0: document.getElementById('s0'),
    v0: document.getElementById('v0'),
    btn: document.getElementById('calculateBtn'),
    sEq: document.getElementById('s-eq'),
    vEq: document.getElementById('v-eq'),
    aEq: document.getElementById('a-eq'),
    tSlider: document.getElementById('t-slider'),
    tVal: document.getElementById('t-val'),
    particle: document.getElementById('particle'),
    liveS: document.getElementById('live-s'),
    liveV: document.getElementById('live-v'),
    liveA: document.getElementById('live-a'),
    ticksContainer: document.getElementById('ticks-container'),
    world: document.getElementById('world'),
};

let currentS = {}, currentV = {}, currentA = {};
let kinematicChart = null; // 用于存储图表实例
const pixelScale = 5; // 数轴缩放比例 (1m = 5px，防止跑太快出界)
const centerOffset = 50; // 数轴中心点在 50%

// 初始化数轴刻度 (-100 到 100，每隔 20 标一个刻度)
function drawTicks() {
    DOM.ticksContainer.innerHTML = '';
    // 画一个足够宽的范围：从 -2000 到 2000，绝对够你跑的了！
    for (let i = -2000; i <= 2000; i += 50) {
        let tick = document.createElement('div');
        tick.className = 'tick';
        tick.style.left = `${i * pixelScale}px`; // 现在刻度是相对于 world 的绝对位置
        
        let label = document.createElement('div');
        label.className = 'tick-label';
        label.style.left = `${i * pixelScale}px`;
        label.textContent = i;
        
        DOM.ticksContainer.appendChild(tick);
        DOM.ticksContainer.appendChild(label);
    }
}

// 监听窗口大小改变，重新画刻度保持居中对齐
window.addEventListener('resize', drawTicks);

DOM.inputType.addEventListener('change', (e) => {
    const type = e.target.value;
    DOM.s0Group.style.display = (type === 'v' || type === 'a') ? 'flex' : 'none';
    DOM.v0Group.style.display = (type === 'a') ? 'flex' : 'none';
});

// 解析多项式
function parsePolynomial(str) {
    str = str.replace(/\s+/g, '').replace(/-/g, '+-');
    if (str.startsWith('+')) str = str.slice(1);
    let terms = str.split('+').filter(t => t);
    let poly = {};
    
    terms.forEach(term => {
        let coef = 1, power = 0;
        if (term.includes('t')) {
            let parts = term.split('t');
            let cStr = parts[0];
            if (cStr === '' || cStr === '+') coef = 1;
            else if (cStr === '-') coef = -1;
            else coef = parseFloat(cStr);

            power = (parts[1] && parts[1].startsWith('^')) ? parseInt(parts[1].slice(1)) : 1;
        } else {
            coef = parseFloat(term);
            power = 0;
        }
        if (!isNaN(coef) && !isNaN(power)) poly[power] = (poly[power] || 0) + coef;
    });
    return Object.keys(poly).length ? poly : {0: 0};
}

// 求导
function differentiate(poly) {
    let res = {};
    for (let p in poly) {
        let power = parseInt(p);
        if (power > 0) res[power - 1] = poly[p] * power;
    }
    return Object.keys(res).length ? res : {0: 0};
}

// 积分
function integrate(poly, constant) {
    let res = { 0: parseFloat(constant) || 0 };
    for (let p in poly) {
        let power = parseInt(p);
        res[power + 1] = poly[p] / (power + 1);
    }
    return res;
}

// 转字符串
function polyToString(poly) {
    let powers = Object.keys(poly).map(Number).sort((a, b) => b - a);
    let str = "";
    for (let i = 0; i < powers.length; i++) {
        let p = powers[i], c = poly[p];
        if (Math.abs(c) < 0.0001) continue; 
        c = Math.round(c * 1000) / 1000;
        let sign = c > 0 ? (str ? " + " : "") : (str ? " - " : "-");
        let tStr = p === 0 ? "" : (p === 1 ? "t" : "t^" + p);
        str += sign + ((Math.abs(c) === 1 && p !== 0) ? "" : Math.abs(c)) + tStr;
    }
    return str || "0";
}

// 代入求值
function evaluate(poly, t) {
    let sum = 0;
    for (let p in poly) sum += poly[p] * Math.pow(t, parseInt(p));
    return sum;
}

// 绘制函数图表 (Graph)
function drawGraph() {
    const ctx = document.getElementById('kinematicChart').getContext('2d');
    let labels = [], dataS = [], dataV = [], dataA = [];
    
    // 计算到 t=50，步长 0.5 保证曲线平滑
    for (let t = 0; t <= 25; t += 0.5) {
        labels.push(t);
        dataS.push(evaluate(currentS, t));
        dataV.push(evaluate(currentV, t));
        dataA.push(evaluate(currentA, t));
    }

    if (kinematicChart) kinematicChart.destroy();

    kinematicChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Displacement s(t)', data: dataS, borderColor: '#3498db', pointRadius: 0, borderWidth: 2 },
                { label: 'Velocity v(t)', data: dataV, borderColor: '#e74c3c', pointRadius: 0, borderWidth: 2 },
                { label: 'Acceleration a(t)', data: dataA, borderColor: '#2ecc71', pointRadius: 0, borderWidth: 2 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { title: { display: true, text: 'Time (s)' } },
                y: { 
                    title: { display: true, text: 'Value' },
                    // 加上 suggestedMax 避免 y 轴被单一极大值撑得太死
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            // 如果数值太大，用科学计数法或 K 表示，显得你专业一点
                            return Math.abs(value) > 1000 ? (value/1000).toFixed(1) + 'k' : value;
                        }
                    }
                }
            },
            plugins: {
                tooltip: { enabled: true },
                legend: {
                    onClick: (e, legendItem, legend) => {
                        // 允许用户点击隐藏某个曲线，这样大数值就不会干扰小数值的观察了
                        const index = legendItem.datasetIndex;
                        const ci = legend.chart;
                        if (ci.isDatasetVisible(index)) {
                            ci.hide(index);
                            legendItem.hidden = true;
                        } else {
                            ci.show(index);
                            legendItem.hidden = false;
                        }
                    }
                }
            }
        }
    });
}

// 计算按钮逻辑
DOM.btn.addEventListener('click', () => {
    const type = DOM.inputType.value;
    const inputPoly = parsePolynomial(DOM.eqInput.value || "0");
    const s0Val = parseFloat(DOM.s0.value) || 0;
    const v0Val = parseFloat(DOM.v0.value) || 0;

    if (type === 's') {
        currentS = inputPoly;
        currentV = differentiate(currentS);
        currentA = differentiate(currentV);
    } else if (type === 'v') {
        currentV = inputPoly;
        currentA = differentiate(currentV);
        currentS = integrate(currentV, s0Val);
    } else if (type === 'a') {
        currentA = inputPoly;
        currentV = integrate(currentA, v0Val);
        currentS = integrate(currentV, s0Val);
    }

    DOM.sEq.textContent = polyToString(currentS);
    DOM.vEq.textContent = polyToString(currentV);
    DOM.aEq.textContent = polyToString(currentA);

    drawTicks(); // 生成数轴刻度
    drawGraph(); // 绘制图表
    updateSimulation(); // 更新动画
});

// 滑块逻辑
DOM.tSlider.addEventListener('input', updateSimulation);

function updateSimulation() {
    const t = parseFloat(DOM.tSlider.value);
    DOM.tVal.textContent = t.toFixed(1);

    const s = evaluate(currentS, t);
    const v = evaluate(currentV, t);
    const a = evaluate(currentA, t);

    DOM.liveS.textContent = s.toFixed(2);
    DOM.liveV.textContent = v.toFixed(2);
    DOM.liveA.textContent = a.toFixed(2);

    // 【高阶操作看好了！】
    // 1. 小球在 world 里面乖乖根据 s 移动
    DOM.particle.style.transform = `translate(calc(-50% + ${s * pixelScale}px), -50%)`;
    
    // 2. 镜头 (world) 朝着相反方向移动，抵消位移，让小球永远居中！
    DOM.world.style.transform = `translateX(${-s * pixelScale}px)`;
}

// 初始化
DOM.inputType.dispatchEvent(new Event('change'));
// 给个默认方程免得画面太空
DOM.eqInput.value = "t^2 - 4t";
DOM.btn.click();
