const CYCLE_MINUTES = 90;

const form = document.querySelector("#sleep-form");
const wakeTimeInput = document.querySelector("#wake-time");
const bufferInput = document.querySelector("#buffer-time");
const SVG_NS = "http://www.w3.org/2000/svg";
const CLOCK_CENTER = 260;
const CLOCK_RADIUS = 154;

function formatTime(totalMinutes) {
  const minutesInDay = 24 * 60;
  const normalized = ((totalMinutes % minutesInDay) + minutesInDay) % minutesInDay;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function pointOnClock(totalMinutes, radius) {
  const normalizedMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  const angle = (normalizedMinutes / 1440) * Math.PI * 2 - Math.PI / 2;

  return {
    x: CLOCK_CENTER + Math.cos(angle) * radius,
    y: CLOCK_CENTER + Math.sin(angle) * radius
  };
}

function describeArc(startMinutes, endMinutes, radius) {
  let duration = endMinutes - startMinutes;
  if (duration <= 0) {
    duration += 1440;
  }

  const start = pointOnClock(startMinutes, radius);
  const end = pointOnClock(startMinutes + duration, radius);
  const largeArcFlag = duration > 720 ? 1 : 0;

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

function createSvgElement(tagName, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tagName);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
  return element;
}

function renderClockBase() {
  const ticksGroup = document.querySelector("#clock-ticks");
  const labelsGroup = document.querySelector("#clock-labels");

  for (let index = 0; index < 48; index += 1) {
    const isMajor = index % 3 === 0;
    const outer = pointOnClock(index * 30, 196);
    const inner = pointOnClock(index * 30, isMajor ? 178 : 185);
    const line = createSvgElement("line", {
      x1: inner.x,
      y1: inner.y,
      x2: outer.x,
      y2: outer.y,
      class: isMajor ? "clock-tick clock-tick-major" : "clock-tick"
    });
    ticksGroup.appendChild(line);
  }

  [
    { minutes: 0, label: "午夜" },
    { minutes: 360, label: "6 AM" },
    { minutes: 720, label: "中午" },
    { minutes: 1080, label: "6 PM" }
  ].forEach(({ minutes, label }) => {
    const point = pointOnClock(minutes, 224);
    const text = createSvgElement("text", {
      x: point.x,
      y: point.y + 5,
      "text-anchor": "middle",
      class: "clock-hour-label"
    });
    text.textContent = label;
    labelsGroup.appendChild(text);
  });
}

function addClockMarker(group, minutes, label, color, radiusOffset) {
  const inner = pointOnClock(minutes, 188);
  const outer = pointOnClock(minutes, radiusOffset);
  const line = createSvgElement("line", {
    x1: inner.x,
    y1: inner.y,
    x2: outer.x,
    y2: outer.y,
    class: "clock-marker-line",
    stroke: color
  });
  const dot = createSvgElement("circle", {
    cx: inner.x,
    cy: inner.y,
    r: 7,
    class: "clock-marker-dot",
    fill: color
  });
  const textPoint = pointOnClock(minutes, radiusOffset + 12);
  const text = createSvgElement("text", {
    x: textPoint.x,
    y: textPoint.y + 4,
    "text-anchor": textPoint.x < CLOCK_CENTER - 15 ? "end" : textPoint.x > CLOCK_CENTER + 15 ? "start" : "middle",
    class: "clock-marker-text",
    fill: color
  });
  text.textContent = label;

  group.append(line, dot, text);
}

function renderSleepClock(wakeMinutes, bufferMinutes) {
  const arcsGroup = document.querySelector("#clock-arcs");
  const markersGroup = document.querySelector("#clock-markers");
  arcsGroup.replaceChildren();
  markersGroup.replaceChildren();

  const definitions = createSvgElement("defs");
  const gradient = createSvgElement("linearGradient", {
    id: "sleep-gradient",
    x1: "0%",
    y1: "0%",
    x2: "100%",
    y2: "100%"
  });
  gradient.append(
    createSvgElement("stop", { offset: "0%", "stop-color": "#7666d2" }),
    createSvgElement("stop", { offset: "100%", "stop-color": "#b3a8ff" })
  );
  definitions.appendChild(gradient);
  arcsGroup.appendChild(definitions);

  const sleepStart = wakeMinutes - 5 * CYCLE_MINUTES;
  const preparationStart = sleepStart - bufferMinutes;

  if (bufferMinutes > 0) {
    arcsGroup.appendChild(
      createSvgElement("path", {
        d: describeArc(preparationStart, sleepStart, CLOCK_RADIUS),
        class: "clock-wind-down-arc"
      })
    );
  }

  arcsGroup.appendChild(
    createSvgElement("path", {
      d: describeArc(sleepStart, wakeMinutes, CLOCK_RADIUS),
      class: "clock-cycle-arc"
    })
  );

  for (let cycle = 0; cycle <= 5; cycle += 1) {
    const dividerMinutes = sleepStart + cycle * CYCLE_MINUTES;
    const dividerInner = pointOnClock(dividerMinutes, 118);
    const dividerOuter = pointOnClock(dividerMinutes, 190);
    arcsGroup.appendChild(
      createSvgElement("line", {
        x1: dividerInner.x,
        y1: dividerInner.y,
        x2: dividerOuter.x,
        y2: dividerOuter.y,
        class: "clock-cycle-divider"
      })
    );
  }

  addClockMarker(markersGroup, wakeMinutes - 6 * CYCLE_MINUTES - bufferMinutes, "6 週期", "#7d86aa", 216);
  addClockMarker(markersGroup, preparationStart, "5 週期", "#c1b7ff", 232);
  addClockMarker(markersGroup, wakeMinutes - 4 * CYCLE_MINUTES - bufferMinutes, "4 週期", "#7d86aa", 216);
  addClockMarker(markersGroup, wakeMinutes, "起床", "#f4f5ff", 232);

  document.querySelector("#clock-wake-time").textContent = formatTime(wakeMinutes);
}

function calculateBedtimes() {
  if (!wakeTimeInput.value) {
    return;
  }

  const [hours, minutes] = wakeTimeInput.value.split(":").map(Number);
  const wakeMinutes = hours * 60 + minutes;
  const bufferMinutes = Number(bufferInput.value);

  [4, 5, 6].forEach((cycles) => {
    const bedtime = wakeMinutes - cycles * CYCLE_MINUTES - bufferMinutes;
    document.querySelector(`#result-${cycles}`).textContent = formatTime(bedtime);
    document.querySelector(`#clock-time-${cycles}`).textContent = formatTime(bedtime);
  });

  renderSleepClock(wakeMinutes, bufferMinutes);

  localStorage.setItem("r90-wake-time", wakeTimeInput.value);
  localStorage.setItem("r90-buffer-time", bufferInput.value);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  calculateBedtimes();
});

bufferInput.addEventListener("change", calculateBedtimes);

const savedWakeTime = localStorage.getItem("r90-wake-time");
const savedBufferTime = localStorage.getItem("r90-buffer-time");

if (savedWakeTime) {
  wakeTimeInput.value = savedWakeTime;
}

if (savedBufferTime) {
  bufferInput.value = savedBufferTime;
}

renderClockBase();
calculateBedtimes();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Offline support is optional; the calculator remains fully functional.
    });
  });
}
