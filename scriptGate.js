
let updatedRows = {};

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw_zFqkaayOFuDIkwmKPnUBJZgkWPlVybF0w4zxEBcRrIj_EFVr_AmQoszDVkMWGi2s/exec";
let data = [];
let currentPage = 1;
const rowsPerPage = 12;
let isTyping = false;
let invoiceImages = [];
const MAX_IMAGES = 4;

// Check login
if (!sessionStorage.getItem('loggedIn')) {
    window.location.href = 'index.html';
}

// Logout function
function logout() {
    sessionStorage.removeItem('loggedIn');
    window.location.href = 'index.html';
}

const searchBox = document.getElementById("tableSearch");
searchBox.addEventListener("input", () => { isTyping = true; renderReadOnlyTable(); });
searchBox.addEventListener("blur", () => { isTyping = false; });

function resetForm() {
    document.getElementById("vehicleForm").reset();
    document.getElementById("invoiceCapture").value = "";
    document.getElementById("previewBox").innerHTML = "";
    invoiceImages = [];
}

function showToast(msg, bgColor = '#28a745') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.style.background = bgColor;
    toast.style.display = 'block';
    toast.style.opacity = 1;
    setTimeout(() => {
        toast.style.transition = "opacity 0.5s";
        toast.style.opacity = 0;
        setTimeout(() => toast.style.display = 'none', 500);
    }, 2000);
}

async function submitForm() {
    let msg = "";
    if (!document.getElementById("vtype").value.trim()) msg += "Select Vehicle Type\n";
    if (!document.getElementById("vehicle").value.trim()) msg += ", Enter Vehicle Number\n";
    if (!document.getElementById("material").value.trim()) msg += ", Enter Material\n";
    const qty = document.getElementById("qty").value.trim();
    if (!qty) msg += ", Enter Quantity\n";
    if (!document.getElementById("gate").value.trim()) msg += ", Select Reporting Gate\n";
    const mobile = document.getElementById("mobile").value.trim();
    if (mobile && !/^\d{10}$/.test(mobile)) msg += ", Mobile Number Must be 10 Digits\n";
    if (msg) { showToast("Please Enter:\n" + msg, "#dc3545"); return; }

    const fd = new FormData(document.getElementById("vehicleForm"));
    fd.append("timestamp", new Date().toLocaleString('en-IN'));

    // ---------------- ADD SECURITY ----------------
    const TOKEN = "VEH@2026#SECURE";  // same as Apps Script SECRET_TOKEN
    fd.append("token", TOKEN);
    fd.append("ts", Date.now());      // current time in ms

    const pdfBlob = await imagesToPDF();
    if (pdfBlob) fd.append("invoice_pdf", pdfBlob, "invoice.pdf");

    const btn = document.querySelector(".btn-primary");
    btn.disabled = true;
    btn.textContent = "Saving...";

    fetch(SCRIPT_URL, { method: "POST", body: fd })
        .then(res => res.json())
        .then(res => {
            if (res.ok) {
                showToast("✔ Saved Successfully!");
                resetForm();
                fetchReadOnlyData();  // refresh table
            } else {
                showToast("Error: " + res.msg, "#dc3545");
            }
        })
        .catch(() => showToast("Error: Check script URL", "#dc3545"))
        .finally(() => { btn.disabled = false; btn.textContent = "Save Entry"; });
}

let lastResponseMap = {};  // store last responses

async function fetchReadOnlyData() {
    try {
        const params = new URLSearchParams({
            token: "VEH@2026#SECURE",
            ts: Date.now()
        });

        const res = await fetch(SCRIPT_URL + "?" + params.toString());
        const newData = await res.json();

        if (newData.ok === false) {
            console.log(newData.msg);
            return;
        }

        data = newData;
        renderReadOnlyTable();

    } catch (e) {
        console.log("Fetch error", e);
    }
}

function renderReadOnlyTable() {
    const gateValue = document.getElementById("gateFilter").value;

    const tbody = document.querySelector("#readOnlyTable tbody");
    const search = document.getElementById("tableSearch").value.toLowerCase();

    const startVal = document.getElementById("startDate").value;
    const endVal = document.getElementById("endDate").value;

    const startDate = startVal ? new Date(startVal + "T00:00:00") : null;
    const endDate = endVal ? new Date(endVal + "T23:59:59") : null;

    let filtered = data.filter(row => {
        let rowDate = null;
        if (row.timestamp) {
            const cleanTS = row.timestamp.replace(/(\d{2})-(\d{2})-(\d{4})/, "$3-$2-$1");
            rowDate = new Date(cleanTS);
        }

        if (startDate && rowDate && rowDate < startDate) return false;
        if (endDate && rowDate && rowDate > endDate) return false;

        if (gateValue && row.Gate !== gateValue) return false;

        // Search filter
        const tempRow = { ...row, Response: row.Response || 'Waiting' };
        const rowStr = Object.values(tempRow).join(" ").toLowerCase();
        if (search && !rowStr.includes(search)) return false;

        return true;
    }).reverse();


    const totalPages = Math.ceil(filtered.length / rowsPerPage);
    if (currentPage > totalPages) currentPage = 1;
    const start = (currentPage - 1) * rowsPerPage;
    const pageData = filtered.slice(start, start + rowsPerPage);

    tbody.innerHTML = "";

    if (pageData.length === 0) {
        tbody.innerHTML = `
    <tr>
      <td colspan="14" style="text-align:center; padding:15px; color:red; font-weight:bold;">
        No record found
      </td>
    </tr>
  `;
        renderPagination(0);
        return;
    }

    pageData.forEach(row => {
        const tr = document.createElement("tr");
        tr.setAttribute("data-id", row.ID);
        const formattedTime = formatDateSheet(row.timestamp);

        tr.innerHTML = `
      <td>${row.ID}</td>
      <td>${row["Vehicle Type"]}</td>
      <td>${row["Vehicle No"]}</td>
      <td>${row.Material}</td>
      <td>${row.Quantity}</td>
      <td>${row.Gate}</td>
      <td>${formattedTime}</td>
      <td>${row.Mobile ? row.Mobile : '-'}</td>
      <td class="remark-cell">${row.Notes ? row.Notes : '-'}</td>
      <td><span class="response-cell">${row.Response || 'Waiting'}</span></td>
      <td>
        ${row.ResponseTime
                ? (() => {
                    const parts = row.ResponseTime.split(", ");
                    const dateParts = parts[0].split("/");
                    const timeParts = parts[1].split(/[: ]/);

                    let h = parseInt(timeParts[0], 10);
                    const m = timeParts[1];
                    const ampm = timeParts[2];

                    if (ampm === "PM" && h < 12) h += 12;
                    if (ampm === "AM" && h === 12) h = 0;

                    const d = new Date(
                        parseInt(dateParts[2], 10),
                        parseInt(dateParts[1], 10) - 1,
                        parseInt(dateParts[0], 10),
                        h,
                        parseInt(m, 10)
                    );

                    const now = new Date();
                    const isToday = d.toDateString() === now.toDateString();

                    const hours12 = ((d.getHours() + 11) % 12 + 1);
                    return isToday ? `${hours12}:${m} ${ampm}` : row.ResponseTime;
                })()
                : "-"}
      </td>
      <td>${row.RespondBy ? getFirstTwoWords(row.RespondBy) : '-'}</td>
      <td><span class="status-cell">${row.Status || 'Pending'}</span></td>
      <td class="remark-cell">${row.Remark ? row.Remark : '-'}</td>
    `;

        tbody.appendChild(tr);

        const responseCell = tr.querySelector(".response-cell");
        responseCell.style.fontWeight = "bold";
        responseCell.style.color = responseCell.textContent === "Waiting" ? "red" : "green";

        const statusCell = tr.querySelector(".status-cell");
        statusCell.style.fontWeight = "bold";
        if (["Pending", "Hold"].includes(statusCell.textContent)) statusCell.style.color = "red";
        else if (["In Process", "Lab-Test", "Unloading", "Loading"].includes(statusCell.textContent)) statusCell.style.color = "orange";
        else if (statusCell.textContent === "Complete") statusCell.style.color = "green";
    });

    // Pagination
    const pag = document.getElementById("readOnlyPagination");
    pag.innerHTML = "";
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement("button");
        btn.textContent = i;
        if (i === currentPage) btn.classList.add("active");
        btn.onclick = () => { currentPage = i; renderReadOnlyTable(); };
        pag.appendChild(btn);
    }
}

// Set default 2-day date range on page load
document.addEventListener("DOMContentLoaded", () => {
    const today = new Date();

    // 1 din pichhe
    const twoDaysBack = new Date();
    twoDaysBack.setDate(today.getDate() - 1);

    const formatDate = (d) => {
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${yyyy}-${mm}-${dd}`;
    };

    document.getElementById("startDate").value = formatDate(twoDaysBack);
    document.getElementById("endDate").value = formatDate(today);

    renderReadOnlyTable();
});



function formatDateSheet(timestamp) {
    if (!timestamp) return '-';
    const d = new Date(timestamp);
    if (isNaN(d)) return timestamp;

    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    let hours = d.getHours();
    let minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    hours = String(hours).padStart(2, '0');

    if (isToday) {
        return `${hours}:${minutes} ${ampm}`;
    } else {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}, ${hours}:${minutes} ${ampm}`;
    }
}

fetchReadOnlyData();
setInterval(() => { if (!isTyping) fetchReadOnlyData(); }, 5000);

document.addEventListener("DOMContentLoaded", () => {
    const userName = sessionStorage.getItem("userName") || "Guest";
    document.getElementById("welcomeUser").innerText = "Welcome: " + userName;
});
function getFirstTwoWords(fullName) {
    if (!fullName) return "-";
    const parts = fullName.trim().split(" ");
    return parts.slice(0, 2).join(" "); // first 2 words
}

function playAlertSound(id) {
    if (!soundEnabled) return;

    const audioSrc = "https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg";
    const beep = new Audio(audioSrc);

    const rowElement = document.querySelector(`tr[data-id='${id}']`);
    if (!rowElement) return;

    // Shake ON + Yellow ON
    rowElement.classList.add("shake", "highlight-yellow");

    beep.onloadedmetadata = () => {

        beep.play();

        const shakeTime = beep.duration * 1000;

        setTimeout(() => {
            rowElement.classList.remove("shake", "highlight-yellow");
        }, shakeTime);
    };
}


let soundEnabled = true;

function toggleSound() {
    soundEnabled = !soundEnabled;
    document.getElementById("soundBtn").innerText =
        soundEnabled ? "🔊" : "🔇";
}



const invoiceInput = document.getElementById('invoiceCapture');

function openCamera() {
    // Mobile devices: camera
    invoiceInput.setAttribute('capture', 'environment'); // rear camera
    invoiceInput.click();
}

function openUpload() {
    // Upload file picker
    invoiceInput.removeAttribute('capture'); // normal file picker
    invoiceInput.click();
}

function previewInvoice(event) {
    const files = [...event.target.files];
    const box = document.getElementById("previewBox");

    for (let file of files) {

        if (invoiceImages.length >= MAX_IMAGES) {
            alert(`Max ${MAX_IMAGES} photos allowed`);
            break;
        }

        invoiceImages.push(file);

        const wrapper = document.createElement("div");
        wrapper.style.position = "relative";

        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.style.width = "90px";
        img.style.height = "90px";
        img.style.objectFit = "cover";
        img.style.border = "1px solid #ccc";
        img.style.borderRadius = "6px";

        const delBtn = document.createElement("span");
        delBtn.innerText = "✖";
        delBtn.style.position = "absolute";
        delBtn.style.top = "-8px";
        delBtn.style.right = "-8px";
        delBtn.style.background = "#ff4d4d";
        delBtn.style.color = "#fff";
        delBtn.style.width = "20px";
        delBtn.style.height = "20px";
        delBtn.style.display = "flex";
        delBtn.style.alignItems = "center";
        delBtn.style.justifyContent = "center";
        delBtn.style.borderRadius = "50%";
        delBtn.style.cursor = "pointer";
        delBtn.style.fontSize = "12px";

        delBtn.onclick = () => {
            invoiceImages = invoiceImages.filter(f => f !== file);
            wrapper.remove();
        };

        wrapper.appendChild(img);
        wrapper.appendChild(delBtn);
        box.appendChild(wrapper);
    }

    event.target.value = "";
}

function toBase64(file) {
    return new Promise(res => {
        const r = new FileReader();
        r.onload = e => res(e.target.result);
        r.readAsDataURL(file);
    });
}

async function imagesToPDF() {
    if (invoiceImages.length === 0) return null;

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: "a4" });

    for (let i = 0; i < invoiceImages.length; i++) {
        const imgData = await readFileAsDataURL(invoiceImages[i]);

        const img = new Image();
        img.src = imgData;

        await new Promise(resolve => {
            img.onload = () => {
                if (i > 0) pdf.addPage();

                // Compress using canvas
                const canvas = document.createElement("canvas");
                const maxWidth = 1200; // max width in px to reduce size
                const scale = Math.min(1, maxWidth / img.width);
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;

                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // Convert to JPEG with quality 0.6
                const compressedData = canvas.toDataURL("image/jpeg", 0.6);

                // Fit to A4 width (190mm)
                const pdfWidth = 190;
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                pdf.addImage(compressedData, "JPEG", 10, 10, pdfWidth, pdfHeight);

                resolve();
            };
        });
    }

    return pdf.output("blob");
}

function readFileAsDataURL(file) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.readAsDataURL(file);
    });
}

