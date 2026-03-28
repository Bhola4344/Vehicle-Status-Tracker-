
const SHEET_URL = "https://script.google.com/macros/s/AKfycbw_zFqkaayOFuDIkwmKPnUBJZgkWPlVybF0w4zxEBcRrIj_EFVr_AmQoszDVkMWGi2s/exec";
let lastDataCount = 0;
let statusFilter = "";
let data = [];
let currentPage = 1;
const rowsPerPage = 12;
let dropdownCache = {};

// Check login status
if (!sessionStorage.getItem('loggedIn')) {
    window.location.href = 'index.html';
}

function logout() {
    sessionStorage.removeItem('loggedIn');
    window.location.href = 'index.html';
}

function showToast(message, bgColor = '#28a745') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.background = bgColor;
    toast.style.display = 'block';
    toast.style.opacity = 1;

    setTimeout(() => {
        toast.style.transition = "opacity 0.5s";
        toast.style.opacity = 0;
        setTimeout(() => toast.style.display = 'none', 500);
    }, 2000);
}




function renderTable() {
    const gateVal = document.getElementById("gateFilter").value;
    const tbody = document.querySelector("#dataTable tbody");
    const search = document.querySelector(".search-input").value.toLowerCase();

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

        const rowStr = Object.values(row).join(" ").toLowerCase();
        if (search && !rowStr.includes(search)) return false;

        if (gateVal && row.Gate !== gateVal) return false;

        if (statusFilter && row.Status !== statusFilter) return false;

        return true;
    });

    // IMPORTANT:
    // ------------------------------------
    window.filteredDataForDashboard = filtered;
    updateStatusBoard(filtered);
    // ------------------------------------

    filtered = filtered.reverse();

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

        const reportingTime = row.timestamp ? formatDate(row.timestamp) : "-";
        const driverMobile = row.Mobile || "-";
        const remark = row.Notes || "-";
        const responseTime = row.ResponseTime ? formatDate(row.ResponseTime) : "-";

        tr.innerHTML = `
      <td>${row.ID}</td>
      <td>${row["Vehicle Type"]}</td>
      <td>
  <span class="vehicle-link"
        onclick='openVehicleModal(${JSON.stringify(row)})'>
    ${row["Vehicle No"]}
  </span>
</td>
      <td>${row.Material}</td>
      <td>${row.Quantity}</td>
      <td>${row.Gate}</td>
      <td>${reportingTime}</td>
      <td>${driverMobile}</td>
      <td class="remark-cell">${remark}</td>

      <td>
        <select class="form-select form-select-sm response-select"
          onchange="updateField(${row.ID}, 'Response', this.value);applyResponseColor(this)">
          <option value="Waiting">WAITING</option>
          <option value="Entry-C34A">ENTRY-C34A</option>
          <option value="Entry-C34">ENTRY-C34</option>
          <option value="Entry-C3">ENTRY-C3</option>
          <option value="Send to C34A">SEND TO C34A</option>
          <option value="Send to C34">SEND TO C34</option>
          <option value="Send to C3">SEND TO C3</option>
          <option value="Out">OUT</option>
        </select>
      </td>

      <td>${responseTime}</td>
      <td>${row.RespondBy ? getFirstTwoWords(row.RespondBy) : '-'}</td>

      <td>
        <select class="form-select form-select-sm status-select"
          onchange="updateField(${row.ID}, 'Status', this.value);applyStatusColor(this)">
          <option value="Pending">PENDING</option>
          <option value="In Process">IN PROCESS</option>
          <option value="Lab-Test">LAB-TEST</option>
          <option value="Unloading">UNLOADING</option>
          <option value="Hold">HOLD</option>
          <option value="Complete">COMPLETE</option>
          <option value="Loading">LOADING</option>
        </select>
      </td>

      <td><input type="text" class="form-control form-control-sm"
          value="${row.Remark || ''}"
          onchange="updateField(${row.ID}, 'Remark', this.value)" /></td>

      <td><button class="btn btn-success btn-sm btn-custom" onclick="updateRow(${row.ID}, this)">Save</button></td>
    `;

        tbody.appendChild(tr);

        const responseSelect = tr.querySelector(".response-select");
        const statusSelect = tr.querySelector(".status-select");

        responseSelect.value = row.Response;
        statusSelect.value = row.Status;

        dropdownCache[row.ID] = { Response: row.Response, Status: row.Status };

        applyResponseColor(responseSelect);
        applyStatusColor(statusSelect);
    });

    renderPagination(totalPages);
}


function applyResponseColor(select) {
    select.style.fontWeight = "bold";
    select.style.color = select.value === "Waiting" ? "red" : "green";
}

function applyStatusColor(select) {
    select.style.fontWeight = "bold";
    if (["Pending", "Hold"].includes(select.value)) select.style.color = "red";
    else if (["In Process", "Lab-Test", "Unloading", "Loading"].includes(select.value)) select.style.color = "orange";
    else if (select.value === "Complete") select.style.color = "green";
    else select.style.color = "black";
}

function updateField(id, field, value) {
    const row = data.find(r => r.ID == id);
    if (!row) return;

    row[field] = value;

    // Update timestamp and RespondBy only if Response changed from Waiting
    row.ResponseTime = new Date().toISOString();
    row.RespondBy = sessionStorage.getItem("userName") || "Unknown";

    // ⚡ Save to cache immediately so table remembers before save
    dropdownCache[id] = {
        Response: row.Response,
        Status: row.Status
    };

    // Only apply color, do NOT re-render table here
    if (field === "Response") {
        const select = document.querySelector(`select.response-select[onchange*="updateField(${id}"]`);
        if (select) applyResponseColor(select);
    } else if (field === "Status") {
        const select = document.querySelector(`select.status-select[onchange*="updateField(${id}"]`);
        if (select) applyStatusColor(select);
    }
}


const VEHICLE_LOG_URL = "https://script.google.com/macros/s/AKfycbxA0JMKhD8bIlwyAtW52u2md9pAe-K68Ic0a8CT3Lwtq1-hp-NpXGkEbUvp57ij5AhJEg/exec";
// ====================== UPDATE ROW ======================
async function updateRow(id, btn) {
    const row = data.find(r => r.ID == id);
    if (!row) return;

    // Set RespondBy and ResponseTime if empty
    if (!row.RespondBy) row.RespondBy = sessionStorage.getItem("userName") || "Unknown";
    if (!row.ResponseTime) row.ResponseTime = new Date().toISOString();

    const formData = new FormData();
    formData.append("token", "VEH@2026#SECURE");
    formData.append("ts", Date.now());

    formData.append("ID", row.ID);
    formData.append("Status", row.Status);
    formData.append("Remark", row.Remark);
    formData.append("Response", row.Response);
    formData.append("RespondBy", row.RespondBy);
    formData.append("ResponseTime", row.ResponseTime);

    formData.append("VehicleNo", row["Vehicle No"] || "");
    formData.append("StoreResponse", row.Response || "");
    formData.append("VehicleStatus", row.Status || "");
    formData.append("StoreRemark", row.Remark || "");
    formData.append("ResponseBy", row.RespondBy);
    formData.append("Timestamp", row.Timestamp);

    btn.disabled = true;
    btn.textContent = "Saving...";

    try {
        await fetch(SHEET_URL, { method: "POST", body: formData });
        await fetch(VEHICLE_LOG_URL, { method: "POST", body: formData });

        showToast("✔ Saved Successfully!");
        fetchData(false); // Refresh table after save
    } catch (e) {
        console.error(e);
        showToast("⚠ Saved! (Network Issue)", "#dc3545");
        fetchData(false);
    } finally {
        btn.disabled = false;
        btn.textContent = "Save";
    }
}

async function refreshData(btn) {
    btn.disabled = true;
    btn.textContent = "Refreshing...";
    try {
        await fetchData(false);
    } catch (e) {
        showToast("Error fetching data", "#dc3545");
    } finally {
        btn.disabled = false;
        btn.textContent = "Refresh";
    }
}

fetchData();
setInterval(() => fetchData(true), 40000);

function formatDate(dt) {
    if (!dt) return "-";

    // Google Sheet se aayi string ko parse karna
    let d;
    if (typeof dt === "string") {
        // Sheet me 24/11/2025, 12:57 AM aata hai
        const parts = dt.split(","); // ["24/11/2025", " 12:57 AM"]
        if (parts.length === 2) {
            const dateParts = parts[0].trim().split("/"); // ["24","11","2025"]
            const timeParts = parts[1].trim().split(/[: ]/); // ["12","57","AM"]
            let hour = parseInt(timeParts[0], 10);
            const minute = parseInt(timeParts[1], 10);
            const ampm = timeParts[2];

            if (ampm.toUpperCase() === "PM" && hour !== 12) hour += 12;
            if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;

            d = new Date(
                parseInt(dateParts[2], 10),
                parseInt(dateParts[1], 10) - 1,
                parseInt(dateParts[0], 10),
                hour,
                minute
            );
        } else {
            d = new Date(dt); // fallback
        }
    } else {
        d = new Date(dt);
    }

    const now = new Date();
    const isToday =
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();

    let displayHour = d.getHours();
    let displayMinute = String(d.getMinutes()).padStart(2, "0");
    const ampm = displayHour >= 12 ? "PM" : "AM";
    displayHour = displayHour % 12;
    if (displayHour === 0) displayHour = 12;

    const timeStr = `${String(displayHour).padStart(2, "0")}:${displayMinute} ${ampm}`;

    if (isToday) return timeStr; // aaj ka time sirf show kare
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();

    return `${day}/${month}/${year}, ${timeStr}`;
}

function renderPagination(totalPages) {
    const pag = document.getElementById("pagination");
    pag.innerHTML = "";

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement("button");
        btn.textContent = i;

        if (i === currentPage) btn.classList.add("active");

        btn.onclick = () => {
            currentPage = i;
            renderTable();
        };
        pag.appendChild(btn);
    }
}

// ====================== FETCH DATA ======================
async function fetchData(isAutoRefresh = false) {
    try {
        const params = new URLSearchParams({
            token: "VEH@2026#SECURE",
            ts: Date.now()
        });

        const res = await fetch(`${SHEET_URL}?${params.toString()}`);
        const fetchedData = await res.json();

        if (!fetchedData.ok && fetchedData.msg) {
            console.log(fetchedData.msg);
            return;
        }

        // Play sound if new rows added
        if (fetchedData.length > lastDataCount && lastDataCount !== 0) {
            if (soundEnabled) playAlertSound();
        }
        lastDataCount = fetchedData.length;

        fetchedData.forEach(row => {
            if (isAutoRefresh && dropdownCache[row.ID]) {
                row.Response = dropdownCache[row.ID].Response;
                row.Status = dropdownCache[row.ID].Status;
            } else {
                row.Response = row.Response || "Waiting";
                row.Status = row.Status || "Pending";
            }
        });

        data = fetchedData;

        renderTable();
        updateStatusBoard(window.filteredDataForDashboard || data);

    } catch (e) {
        console.log("Error fetching data:", e);
    }
}


function updateStatusBoard(filtered) {
    const list = filtered || [];

    document.getElementById("totalReported").innerText = list.length;
    document.getElementById("totalEntered").innerText =
        list.filter(d => d.Status === "In Process" || d.Status === "Entered").length;

    document.getElementById("totalLabTesting").innerText =
        list.filter(d => d.Status === "Lab-Test").length;

    document.getElementById("totalUnloading").innerText =
        list.filter(d => d.Status === "Unloading").length;

    document.getElementById("totalLoading").innerText =
        list.filter(d => d.Status === "Loading").length;

    document.getElementById("totalPending").innerText =
        list.filter(d => d.Status === "Pending").length;

    document.getElementById("totalHold").innerText =
        list.filter(d => d.Status === "Hold").length;

    document.getElementById("totalOut").innerText =
        list.filter(d => d.Status === "Complete" || d.Status === "Out").length;
}



window.onload = function () {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1); // kal

    const yyyyToday = today.getFullYear();
    const mmToday = String(today.getMonth() + 1).padStart(2, "0");
    const ddToday = String(today.getDate()).padStart(2, "0");
    const endDateStr = `${yyyyToday}-${mmToday}-${ddToday}`;

    const yyyyYest = yesterday.getFullYear();
    const mmYest = String(yesterday.getMonth() + 1).padStart(2, "0");
    const ddYest = String(yesterday.getDate()).padStart(2, "0");
    const startDateStr = `${yyyyYest}-${mmYest}-${ddYest}`;

    document.getElementById("startDate").value = startDateStr;
    document.getElementById("endDate").value = endDateStr;

    renderTable();
    populateItemFilter();

    // ⭐ DEFAULT — Reported active
    const reportedCard = document.querySelector('.status-card[onclick="filterByStatus(\'\')"]');
    if (reportedCard) reportedCard.classList.add("active");
};




document.addEventListener("DOMContentLoaded", () => {
    const userName = sessionStorage.getItem("userName") || "Guest";
    document.getElementById("welcomeUser").innerText = "Welcome: " + userName;
});

function getFirstTwoWords(fullName) {
    if (!fullName) return "-";
    const parts = fullName.trim().split(" ");
    return parts.slice(0, 2).join(" "); // first 2 words
}

function playAlertSound() {
    if (!soundEnabled) return; // 🔇 OFF hoga to sound nahi bajega

    const audioSrc = "https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg";

    for (let i = 0; i < 1; i++) {
        setTimeout(() => {
            const beep = new Audio(audioSrc);
            beep.play();
        }, i * 500);
    }
}

let soundEnabled = true;

function toggleSound() {
    soundEnabled = !soundEnabled;

    document.getElementById("soundBtn").innerText =
        soundEnabled ? "🔊" : "🔇";
}

function filterByStatus(status) {

    statusFilter = status;
    currentPage = 1;
    renderTable();

    document.querySelectorAll(".status-card")
        .forEach(c => c.classList.remove("active"));

    // jispe click hua usko active
    event.currentTarget.classList.add("active");
}



async function openVehicleModal(row) {
    if (!row) return;
    // ---- SUMMARY FIRST (instant) ----
    document.getElementById("summaryVehicle").innerText = row["Vehicle No"] || "-";
    document.getElementById("summaryMaterial").innerText = row.Material || "-";
    document.getElementById("summaryQty").innerText = row.Quantity || "-";
    document.getElementById("summaryReportingTime").innerText = formatDate(row.timestamp || row.ReportingTime || "");
    document.getElementById("summaryReportingGate").innerText = row.Gate || row.ReportingGate || "-";

    // Show modal IMMEDIATELY
    const tbody = document.getElementById("vehicleLogRow");
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Loading...</td></tr>`;
    document.getElementById("vehicleModal").style.display = "flex";

    // ---- FETCH IN BACKGROUND WITH TOKEN ----
    try {
        const params = new URLSearchParams({
            token: "VEH@2026#SECURE",
            ts: Date.now()
        });

        const res = await fetch(
            `https://script.google.com/macros/s/AKfycbxA0JMKhD8bIlwyAtW52u2md9pAe-K68Ic0a8CT3Lwtq1-hp-NpXGkEbUvp57ij5AhJEg/exec?${params.toString()}`,
            { cache: "no-store" }
        );

        const logData = await res.json();

        const vehicleLogs = logData.filter(
            r => r["Vehicle No"] === row["Vehicle No"]
        );

        if (!vehicleLogs.length) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:red;">No records found</td></tr>`;
            return;
        }

        tbody.innerHTML = "";

        vehicleLogs.forEach(r => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
        <td style="padding:8px; border-bottom:1px solid #e5e7eb;">${r["Store Response"] || "-"}</td>
        <td style="padding:8px; border-bottom:1px solid #e5e7eb;">${r["Vehicle Status"] || "-"}</td>
        <td style="padding:8px; border-bottom:1px solid #e5e7eb;">${r["Store Remark"] || "-"}</td>
        <td style="padding:8px; border-bottom:1px solid #e5e7eb;">${r["Response By"] || "-"}</td>
        <td style="padding:8px; border-bottom:1px solid #e5e7eb;">${formatDate(r.Timestamp || "")}</td>
      `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:red;">Error fetching data</td></tr>`;
        console.error(err);
    }
}

function closeVehicleModal() {
    const m = document.getElementById("vehicleModal");
    if (m) m.style.display = "none";
}


function printModal() {
    window.print();
}
