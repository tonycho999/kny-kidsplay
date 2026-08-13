// 전역 변수 선언
let mainPageEditor, periodEditor, guideEditor;
let isSiteConfigured = false; // ⭐️ 핵심: 사이트 기본 설정 완료 여부

// 1. 탭 조각들 불러오기
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
    await checkSiteConfiguration(); // ⭐️ 가장 먼저 DB 상태부터 확인!
}

// 2. 에디터 초기화
function initEditors() {
    var editorOptions = {
        theme: 'snow',
        modules: { toolbar: [ [{ 'header': [1, 2, 3, false] }], ['bold', 'italic', 'underline'], [{ 'color': [] }, { 'background': [] }], [{ 'align': [] }], ['link'] ] }
    };
    mainPageEditor = new Quill('#editor-main-page', editorOptions);
    periodEditor = new Quill('#editor-period', editorOptions);
    guideEditor = new Quill('#editor-guide', editorOptions);
}

// 3. ⭐️ 사이트 설정 여부 확인 및 로드
async function checkSiteConfiguration() {
    try {
        const res = await fetch('/api/admin/site-contents');
        const result = await res.json();
        
        if (result.success && result.data && result.data.site_name) {
            // DB에 데이터가 있을 때 (정상)
            isSiteConfigured = true;
            const d = result.data;
            if (document.getElementById('cms-site-title')) document.getElementById('cms-site-title').value = d.site_name;
            if (document.getElementById('cms-map-url')) document.getElementById('cms-map-url').value = d.map_image_url || '';
            if (document.getElementById('cms-map-address')) document.getElementById('cms-map-address').value = d.map_address || '';
            mainPageEditor.root.innerHTML = d.main_content || '';
            periodEditor.root.innerHTML = d.period_content || '';
            guideEditor.root.innerHTML = d.guide_content || '';
            
            // 데이터가 있으므로 예약 내역 탭을 기본으로 켭니다.
            forceSwitchTab('reservation-tab', document.querySelectorAll('.tab-btn')[0]);
        } else {
            // 🚨 DB에 데이터가 아예 없을 때 (최초 접속)
            isSiteConfigured = false;
            alert("⚠️ 초기 설정이 필요합니다!\n[홈페이지 설정] 탭에서 '타이틀'을 먼저 저장해야 다른 기능을 사용할 수 있습니다.");
            // 강제로 홈페이지 설정 탭으로 이동시킴
            forceSwitchTab('homepage-tab', document.querySelectorAll('.tab-btn')[1]);
        }
    } catch(e) { console.error("설정 확인 오류:", e); }
}

// 4. ⭐️ 탭 클릭 제어 로직
function switchTab(tabId, btnElement) {
    if (!isSiteConfigured && tabId !== 'homepage-tab') {
        alert("⚠️ 먼저 [홈페이지 설정] 탭에서 '홈페이지 타이틀'을 작성하고 저장해 주세요!");
        return; // 차단
    }
    forceSwitchTab(tabId, btnElement);
}

function forceSwitchTab(tabId, btnElement) {
    document.querySelectorAll('.panel').forEach(panel => panel.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    btnElement.classList.add('active');
}

// 5. ⭐️ 홈페이지 설정(site_contents) DB 저장 기능
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
                alert("✅ 홈페이지 설정이 성공적으로 저장되었습니다!\n이제 다른 기능들을 사용할 수 있습니다.");
                isSiteConfigured = true; // 잠금 해제
            } else { alert("저장 실패: " + result.error); }
        } catch(e) { alert("서버 통신 오류가 발생했습니다."); } 
        finally { btn.innerText = "홈페이지 설정 저장하기"; btn.disabled = false; }
    } else {
        alert("기능 테스트 중입니다.");
    }
}

// 시작
document.addEventListener('DOMContentLoaded', loadTabs);
