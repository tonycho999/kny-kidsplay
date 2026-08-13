let mainPageEditor, periodEditor, guideEditor, popupNewEditor;
let isSiteConfigured = false; 
let globalLocations = [];

async function loadTabs() {
    const tabs = [
        { id: 'reservation-tab', file: 'tabs/reserve_list.html' },
        { id: 'homepage-tab', file: 'tabs/homepage_setting.html' },
        { id: 'reserve-setting-tab', file: 'tabs/reserve_setting.html' },
        { id: 'popup-tab', file: 'tabs/popup_setting.html' }
    ];

    for (const tab of tabs) {
        try {
            const res = await fetch(tab.file);
            document.getElementById(tab.id).innerHTML = await res.text();
        } catch (e) { console.error("탭 로드 실패:", tab.file); }
    }

    initEditors();
    await checkSiteConfiguration(); 
}

function initEditors() {
    var opts = { theme: 'snow', modules: { toolbar: [ [{ 'header': [1, 2, 3, false] }], ['bold', 'italic', 'underline'], [{ 'color': [] }, { 'background': [] }], [{ 'align': [] }], ['link'] ] } };
    mainPageEditor = new Quill('#editor-main-page', opts);
    periodEditor = new Quill('#editor-period', opts);
    guideEditor = new Quill('#editor-guide', opts);
    popupNewEditor = new Quill('#editor-popup-new', opts);
}

// ⭐️ 사이트 초기 설정 확인 로직
async function checkSiteConfiguration() {
    try {
        const res = await fetch('/api/admin/site-contents');
        const result = await res.json();
        
        if (result.success && result.data && result.data.site_name) {
            isSiteConfigured = true;
            const d = result.data;
            if (document.getElementById('cms-site-title')) document.getElementById('cms-site-title').value = d.site_name;
            if (document.getElementById('cms-map-url')) document.getElementById('cms-map-url').value = d.map_image_url || '';
            if (document.getElementById('cms-map-address')) document.getElementById('cms-map-address').value = d.map_address || '';
            mainPageEditor.root.innerHTML = d.main_content || '';
            periodEditor.root.innerHTML = d.period_content || '';
            guideEditor.root.innerHTML = d.guide_content || '';
            
            // 데이터가 있으면 모든 기능 로드 및 예약내역 탭 활성화
            loadDynamicOptions();
            loadReserveSettings();
            loadPopups();
            forceSwitchTab('reservation-tab', document.querySelectorAll('.tab-btn')[0]);
        } else {
            isSiteConfigured = false;
            alert("⚠️ 초기 설정이 필요합니다!\n[홈페이지 설정] 탭에서 '타이틀'을 먼저 저장해야 다른 기능을 사용할 수 있습니다.");
            forceSwitchTab('homepage-tab', document.querySelectorAll('.tab-btn')[1]);
        }
    } catch(e) { console.error("설정 확인 오류:", e); }
}

function switchTab(tabId, btnElement) {
    if (!isSiteConfigured && tabId !== 'homepage-tab') {
        alert("⚠️ 먼저 [홈페이지 설정] 탭에서 '홈페이지 타이틀'을 작성하고 저장해 주세요!");
        return;
    }
    forceSwitchTab(tabId, btnElement);
}

function forceSwitchTab(tabId, btnElement) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    btnElement.classList.add('active');
}

// --------------------------------------------------------
// [1] 홈페이지 설정 저장
// --------------------------------------------------------
async function saveCmsData(type) {
    if (type === 'homepage') {
        const titleVal = document.getElementById('cms-site-title').value.trim();
        if (!titleVal) return alert("❌ '홈페이지 타이틀'은 필수 입력 항목입니다!");

        const btn = document.querySelector("#homepage-tab .btn-submit-cms");
        btn.innerText = "저장 중..."; btn.disabled = true;

        const data = {
            site_name: titleVal,
            map_image_url: document.getElementById('cms-map-url').value,
            map_address: document.getElementById('cms-map-address').value,
            main_content: mainPageEditor.root.innerHTML === '<p><br></p>' ? '' : mainPageEditor.root.innerHTML,
            period_content: periodEditor.root.innerHTML === '<p><br></p>' ? '' : periodEditor.root.innerHTML,
            guide_content: guideEditor.root.innerHTML === '<p><br></p>' ? '' : guideEditor.root.innerHTML
        };
        
        try {
            const res = await fetch('/api/admin/site-contents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            const result = await res.json();
            if(result.success) {
                alert("✅ 홈페이지 설정이 성공적으로 저장되었습니다!");
                if(!isSiteConfigured) {
                    isSiteConfigured = true;
                    loadDynamicOptions(); loadReserveSettings(); loadPopups();
                }
            } else { alert("저장 실패: " + result.error); }
        } catch(e) { alert("서버 통신 오류"); } finally { btn.innerText = "홈페이지 설정 저장하기"; btn.disabled = false; }
    }
}

// --------------------------------------------------------
// [2] 콤보박스 및 예약 설정 연동
// --------------------------------------------------------
async function loadDynamicOptions() {
    try {
        const response = await fetch('/api/admin/init-options');
        const data = await response.json();
        if (data.success) {
            const locSelect = document.getElementById('filterLocation');
            const timeSelect = document.getElementById('filterTime');
            if (locSelect) {
                locSelect.innerHTML = ''; 
                if (data.locations && data.locations.length > 0) {
                    data.locations.forEach(loc => { locSelect.innerHTML += `<option value="${loc.name}">[${data.siteName}] ${loc.name}</option>`; });
                } else { locSelect.innerHTML = `<option value="${data.siteName}">${data.siteName}</option>`; }
            }
            if (timeSelect) {
                timeSelect.innerHTML = '<option value="">모든 회차</option>'; 
                if (data.timeSlots && data.timeSlots.length > 0) {
                    data.timeSlots.forEach(slot => { timeSelect.innerHTML += `<option value="${slot.slot_name}">${slot.slot_name} (${slot.start_time}~${slot.end_time})</option>`; });
                }
            }
        }
    } catch (error) { console.error("옵션 로드 오류:", error); }
}

async function loadReserveSettings() {
    try {
        const res = await fetch('/api/admin/reserve-settings');
        const data = await res.json();
        
        if (data.success) {
            globalLocations = data.locations || [];
            let locOptions = '<option value="">장소 선택</option>';
            globalLocations.forEach(loc => { locOptions += `<option value="${loc.id}">${loc.name}</option>`; });
            
            if(document.getElementById('slot-location-select')) document.getElementById('slot-location-select').innerHTML = locOptions;
            if(document.getElementById('rule-location-select')) document.getElementById('rule-location-select').innerHTML = locOptions;
            if(document.getElementById('notice-location-select')) document.getElementById('notice-location-select').innerHTML = locOptions;

            const locList = document.getElementById('location-list');
            if(locList) locList.innerHTML = globalLocations.map(loc => `<li style="padding:8px 0; color:#0056b3; font-weight:bold;">📍 ${loc.name}</li>`).join('');

            const slotList = document.getElementById('slot-list');
            if(slotList) slotList.innerHTML = (data.timeSlots || []).map(slot => 
                `<li style="padding:10px; background:#fff; border:1px solid #eee; margin-bottom:5px; border-radius:4px; display:flex; justify-content:space-between;">
                    <span>[${slot.location_name}] <strong>${slot.slot_name}</strong> (${slot.start_time}~${slot.end_time}) / 정원 ${slot.capacity}명</span>
                    <button onclick="apiReserveSetting({action:'delete_slot', id:${slot.id}})" style="background:#dc3545; color:white; border:none; border-radius:4px; cursor:pointer; padding:5px 10px;">삭제</button>
                </li>`
            ).join('');

            const ruleList = document.getElementById('rule-list');
            if(ruleList) ruleList.innerHTML = (data.rules || []).map(rule => 
                `<li style="padding:10px; background:#fff; border:1px solid #eee; margin-bottom:5px; border-radius:4px; display:flex; justify-content:space-between;">
                    <span>[${rule.location_name}] 이용일: ${rule.target_start_date} ~ ${rule.target_end_date} ➔ <strong>오픈: ${rule.open_datetime.replace('T', ' ')}</strong></span>
                    <button onclick="apiReserveSetting({action:'delete_rule', id:${rule.id}})" style="background:#dc3545; color:white; border:none; border-radius:4px; cursor:pointer; padding:5px 10px;">삭제</button>
                </li>`
            ).join('');
        }
    } catch(e) { console.error(e); }
}

async function apiReserveSetting(payload) {
    try {
        const res = await fetch('/api/admin/reserve-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const result = await res.json();
        if(result.success) { loadReserveSettings(); loadDynamicOptions(); alert("처리되었습니다!"); } 
        else alert("오류 발생: " + result.error);
    } catch(e) { alert("서버 통신 오류"); }
}

function addLocation() {
    const name = document.getElementById('new-location-name').value;
    if(!name) return alert("장소명을 입력하세요.");
    apiReserveSetting({ action: 'add_location', name: name });
    document.getElementById('new-location-name').value = '';
}
function addTimeSlot() {
    const loc_id = document.getElementById('slot-location-select').value;
    const name = document.getElementById('new-slot-name').value;
    const start = document.getElementById('new-slot-start').value;
    const end = document.getElementById('new-slot-end').value;
    const cap = document.getElementById('new-slot-capacity').value;
    if(!loc_id || !name || !start || !end || !cap) return alert("빈칸을 모두 채워주세요.");
    apiReserveSetting({ action: 'add_slot', location_id: loc_id, slot_name: name, start_time: start, end_time: end, capacity: cap });
}
function addReservationRule() {
    const loc_id = document.getElementById('rule-location-select').value;
    const start = document.getElementById('rule-start-date').value;
    const end = document.getElementById('rule-end-date').value;
    const open = document.getElementById('rule-open-datetime').value;
    if(!loc_id || !start || !end || !open) return alert("빈칸을 모두 채워주세요.");
    apiReserveSetting({ action: 'add_rule', location_id: loc_id, target_start_date: start, target_end_date: end, open_datetime: open });
}
function loadNoticeText() {
    const loc_id = document.getElementById('notice-location-select').value;
    const loc = globalLocations.find(l => String(l.id) === String(loc_id));
    document.getElementById('location-notice-text').value = loc && loc.address_notice_text ? loc.address_notice_text : '';
}
function updateLocationNotice() {
    const loc_id = document.getElementById('notice-location-select').value;
    const text = document.getElementById('location-notice-text').value;
    if(!loc_id) return alert("장소를 선택해주세요.");
    apiReserveSetting({ action: 'update_notice', location_id: loc_id, notice: text });
}

// --------------------------------------------------------
// [3] 팝업 관리 연동
// --------------------------------------------------------
async function loadPopups() {
    try {
        const res = await fetch('/api/admin/popups');
        const result = await res.json();
        const container = document.getElementById('popup-list-container');
        if (result.success && result.data && result.data.length > 0) {
            const pageNames = { 'main': '첫 화면', 'guide': '이용안내', 'period': '운영기간', 'reserve': '예약하기', 'location': '오시는길' };
            container.innerHTML = result.data.map(p => `
                <div style="background:#f8f9fa; border:1px solid #ddd; border-radius:8px; margin-bottom:10px; padding:15px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:10px;">
                        <div>
                            <span style="background:#0056b3; color:white; padding:3px 8px; border-radius:4px; font-size:0.8rem; margin-right:10px;">[${pageNames[p.target_page]}]</span>
                            <strong style="font-size:1.1rem;">${p.title}</strong>
                        </div>
                        <div style="display:flex; gap:15px; align-items:center;">
                            <label style="cursor:pointer; display:flex; align-items:center; gap:5px; font-weight:bold; color:${p.is_active ? '#28a745' : '#888'}">
                                <input type="checkbox" style="width:18px; height:18px;" ${p.is_active ? 'checked' : ''} onchange="apiPopup({action:'toggle', id:${p.id}, is_active: this.checked ? 1 : 0})">
                                ${p.is_active ? '✅ 켜짐' : '끄기'}
                            </label>
                            <button onclick="apiPopup({action:'delete', id:${p.id}})" style="background:#dc3545; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">삭제</button>
                        </div>
                    </div>
                    <div style="font-size:0.9rem; color:#555; background:white; padding:10px; border-radius:4px; border:1px dashed #ccc;">${p.content}</div>
                </div>
            `).join('');
        } else { container.innerHTML = '<p style="color:#999; text-align:center; padding:20px;">등록된 팝업이 없습니다.</p>'; }
    } catch(e) { console.error(e); }
}

function addPopup() {
    const target = document.getElementById('new-popup-target').value;
    const title = document.getElementById('new-popup-title').value.trim();
    const content = popupNewEditor.root.innerHTML;

    if (!title || content === '<p><br></p>') return alert("제목과 팝업 내용을 입력하세요.");
    apiPopup({ action: 'add', target_page: target, title: title, content: content });
    document.getElementById('new-popup-title').value = ''; popupNewEditor.root.innerHTML = '';
}

async function apiPopup(payload) {
    try {
        const res = await fetch('/api/admin/popups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const result = await res.json();
        if(result.success) loadPopups(); else alert("오류 발생: " + result.error);
    } catch(e) { alert("서버 통신 오류"); }
}

document.addEventListener('DOMContentLoaded', loadTabs);
