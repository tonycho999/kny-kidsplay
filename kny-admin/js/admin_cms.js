// =====================================================
// ⭐️ Blogger 설정값 (블로그/라벨이 바뀌면 여기만 수정)
// =====================================================
const BLOG_ID = '6550478255785327417';
const BLOG_URL = 'https://kny-company.blogspot.com';
const SITE_LABEL = 'kny-kidsplay';

const BLOGGER_CREATE_URL = `https://www.blogger.com/blog/post/create/${BLOG_ID}`;
const BLOGGER_LIST_URL = `https://www.blogger.com/blog/posts/${BLOG_ID}`;
const bloggerEditUrl = (postId) => `https://www.blogger.com/blog/post/edit/${BLOG_ID}/${postId}`;

// 고정 제목 글 목록
const PAGE_POSTS = [
    { title: '프로젝트명', where: '모든 페이지 상단 로고 / 브라우저 탭 제목', required: true },
    { title: '첫화면', where: '첫 화면 (index.html)' },
    { title: '운영기간안내', where: '운영기간안내 (period.html)' },
    { title: '이용안내', where: '이용안내 (guide.html)' },
    { title: '오시는길', where: '오시는길 (location.html)' }
];

// 팝업 노출위치로 쓸 수 있는 이름
const POPUP_PAGES = ['첫화면', '운영기간안내', '이용안내', '예약하기', '오시는길'];

// 전역 상태
let isSiteConfigured = false;
let projectName = '';
let bloggerPosts = [];
let initOptions = null;
let globalLocations = [];

// =====================================================
// 공통 유틸
// =====================================================
function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function normalize(s) { return String(s || '').replace(/\s/g, ''); }
function formatDate(iso) {
    return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
// HTML 본문 → 줄 단위 텍스트
function htmlToLines(html) {
    const withBreaks = String(html || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n');
    const div = document.createElement('div');
    div.innerHTML = withBreaks;
    return (div.textContent || '').split('\n').map(l => l.replace(/\u00a0/g, ' ').trim()).filter(Boolean);
}

// =====================================================
// 1. 탭 파일 불러오기 + 초기화
// =====================================================
async function loadTabs() {
    const tabs = [
        { id: 'reservation-tab', file: 'tabs/reserve_list.html' },
        { id: 'homepage-tab', file: 'tabs/homepage_setting.html' },
        { id: 'reserve-setting-tab', file: 'tabs/reserve_setting.html' },
        { id: 'popup-tab', file: 'tabs/popup_setting.html' }
    ];

    for (const tab of tabs) {
        try {
            const res = await fetch(tab.file + '?v=' + Date.now());
            document.getElementById(tab.id).innerHTML = await res.text();
        } catch (e) { console.error('탭 로드 실패:', tab.file); }
    }

    // 회차 정보 먼저 받기 (우천 차단 체크박스 생성용)
    await loadInitOptions();
    fillRainSlotCheckboxes();

    // 예약 내역 관리 스크립트(admin.js)는 화면이 다 만들어진 뒤에 불러옴
    loadAdminScript();

    // Blogger 글 불러오고 잠금 여부 결정
    await loadBloggerContents();

    // 예약 관련 데이터
    loadDynamicOptions();
    loadReserveSettings();
}

function loadAdminScript() {
    if (document.getElementById('admin-legacy-script')) return;
    const s = document.createElement('script');
    s.id = 'admin-legacy-script';
    s.src = '../js/admin.js?v=' + Date.now();
    document.body.appendChild(s);
}

// =====================================================
// 2. 탭 전환 + 잠금
// =====================================================
function switchTab(tabId, btnElement) {
    if (!isSiteConfigured && tabId !== 'homepage-tab') {
        alert("⚠️ 먼저 Blogger에 제목이 '프로젝트명'인 글을 작성해 주세요.\n(라벨: " + SITE_LABEL + ")\n\n작성 후 [🏠 홈페이지 콘텐츠] 탭에서 [🔄 새로고침]을 누르면 잠금이 풀립니다.");
        return;
    }
    forceSwitchTab(tabId, btnElement);
}

function forceSwitchTab(tabId, btnElement) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    if (btnElement) btnElement.classList.add('active');
}

// =====================================================
// 3. Blogger 연동
// =====================================================
function fetchBloggerFeed() {
    return new Promise((resolve, reject) => {
        const cb = '__bloggerCb_' + Date.now();
        const s = document.createElement('script');
        window[cb] = (data) => { resolve(data); delete window[cb]; s.remove(); };
        s.src = `${BLOG_URL}/feeds/posts/default/-/${encodeURIComponent(SITE_LABEL)}?alt=json-in-script&max-results=150&orderby=published&callback=${cb}&_=${Date.now()}`;
        s.onerror = () => { delete window[cb]; s.remove(); reject(new Error('Blogger 피드 로드 실패')); };
        document.body.appendChild(s);
    });
}

function parseEntries(data) {
    return ((data.feed && data.feed.entry) || [])
        // ⭐️ 2차 안전장치: 라벨이 정확히 kny-kidsplay인 글만
        .filter(e => (e.category || []).some(c => c.term === SITE_LABEL))
        .map(e => ({
            title: ((e.title && e.title.$t) || '').trim(),
            html: (e.content && e.content.$t) || (e.summary && e.summary.$t) || '',
            published: e.published.$t,
            updated: e.updated.$t,
            postId: e.id.$t.split('.post-')[1]
        }));
}

// 같은 제목의 글들 (최신순)
function findPosts(title) {
    return bloggerPosts.filter(p => normalize(p.title) === normalize(title));
}

// 팝업 첫 줄의 "노출위치 : ..." 해석
function parsePopup(html) {
    const lines = htmlToLines(html);
    const first = lines[0] || '';
    const m = first.match(/^노출위치\s*[:：]\s*(.+)$/);
    if (!m) return { targets: [], body: lines.join(' '), hasHeader: false };
    const targets = m[1].split(/[,，、]/).map(t => normalize(t)).filter(Boolean);
    return { targets, body: lines.slice(1).join(' '), hasHeader: true };
}

async function loadBloggerContents() {
    const pageTbody = document.getElementById('bl-page-tbody');
    const popupTbody = document.getElementById('bl-popup-tbody');
    if (pageTbody) pageTbody.innerHTML = '<tr><td colspan="5" style="padding:25px; color:#888;">Blogger에서 불러오는 중...</td></tr>';
    if (popupTbody) popupTbody.innerHTML = '<tr><td colspan="4" style="padding:25px; color:#888;">Blogger에서 불러오는 중...</td></tr>';

    try {
        const data = await fetchBloggerFeed();
        bloggerPosts = parseEntries(data);
    } catch (e) {
        bloggerPosts = [];
        if (pageTbody) pageTbody.innerHTML = `<tr><td colspan="5" class="bl-ng" style="padding:25px;">Blogger 연결에 실패했습니다. 블로그가 '공개' 상태인지 확인해 주세요.</td></tr>`;
        if (popupTbody) popupTbody.innerHTML = '';
    }

    // 프로젝트명 확인 → 잠금 여부
    const projectPost = findPosts('프로젝트명')[0];
    projectName = projectPost ? (htmlToLines(projectPost.html)[0] || '') : '';
    isSiteConfigured = !!projectName;

    const nameEl = document.getElementById('admin-project-name');
    if (isSiteConfigured) {
        nameEl.innerText = `${projectName} 예약관리 시스템`;
        document.title = `${projectName} - 예약관리 시스템`;
    } else {
        nameEl.innerText = '물놀이장 예약관리 시스템';
    }

    if (bloggerPosts.length || pageTbody) renderPagePosts();
    renderPopupPosts();

    if (!isSiteConfigured) {
        forceSwitchTab('homepage-tab', document.querySelectorAll('.tab-btn')[1]);
        alert("⚠️ 초기 설정이 필요합니다!\nBlogger에 제목이 '프로젝트명'인 글을 먼저 작성해 주세요.\n(라벨: " + SITE_LABEL + ")");
    }

    // 예약 내역 콤보박스에도 프로젝트명 반영
    loadDynamicOptions();
}

function renderPagePosts() {
    const tbody = document.getElementById('bl-page-tbody');
    if (!tbody) return;

    tbody.innerHTML = PAGE_POSTS.map(item => {
        const posts = findPosts(item.title);
        const latest = posts[0];

        let status, date = '-', action;
        if (latest) {
            status = `<span class="bl-ok">✅ 작성됨</span>`;
            if (posts.length > 1) status += `<span class="bl-warn">⚠️ 같은 제목 글이 ${posts.length}개 있습니다 (최신 글만 사용)</span>`;
            if (item.title === '프로젝트명') status += `<span style="display:block; margin-top:4px; color:#333;">"${escapeHtml(projectName)}"</span>`;
            if (item.title === '오시는길') {
                const hasAddr = htmlToLines(latest.html).some(l => /^주소\s*[:：]/.test(l));
                if (!hasAddr) status += `<span class="bl-warn">⚠️ '주소 : ...' 줄이 없습니다</span>`;
            }
            date = formatDate(latest.updated);
            action = `<a class="bl-btn edit" href="${bloggerEditUrl(latest.postId)}" target="_blank">✏️ 수정하기</a>`;
        } else {
            status = item.required ? `<span class="bl-ng">❌ 없음 (필수)</span>` : `<span class="bl-ng">❌ 없음</span>`;
            action = `<a class="bl-btn new" href="${BLOGGER_CREATE_URL}" target="_blank">📝 새로 작성</a>`;
        }

        return `
            <tr>
                <td style="font-weight:bold;">${escapeHtml(item.title)}</td>
                <td style="text-align:left;">${escapeHtml(item.where)}</td>
                <td>${status}</td>
                <td style="color:#555;">${date}</td>
                <td>${action}</td>
            </tr>`;
    }).join('');
}

function renderPopupPosts() {
    const tbody = document.getElementById('bl-popup-tbody');
    if (!tbody) return;

    const popups = findPosts('팝업');
    if (popups.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="padding:25px; color:#888;">게시된 팝업이 없습니다.</td></tr>`;
        return;
    }

    tbody.innerHTML = popups.map(p => {
        const { targets, body, hasHeader } = parsePopup(p.html);
        let targetHtml;
        if (!hasHeader) {
            targetHtml = `<span class="bl-ng">❌ 첫 줄에 '노출위치 : ...'가 없습니다</span>`;
        } else {
            targetHtml = targets.map(t => POPUP_PAGES.includes(t)
                ? `<span class="bl-tag">${escapeHtml(t)}</span>`
                : `<span class="bl-tag bad" title="인식할 수 없는 이름">⚠️ ${escapeHtml(t)}</span>`
            ).join('');
        }
        const preview = body.length > 60 ? body.substring(0, 60) + '...' : body;

        return `
            <tr>
                <td>${targetHtml}</td>
                <td style="text-align:left; color:#444;">${escapeHtml(preview) || '<span style="color:#aaa;">(내용 없음)</span>'}</td>
                <td style="color:#555;">${formatDate(p.updated)}</td>
                <td><a class="bl-btn edit" href="${bloggerEditUrl(p.postId)}" target="_blank">✏️ 수정하기</a></td>
            </tr>`;
    }).join('');
}

// =====================================================
// 4. 회차 정보 / 우천 차단 체크박스
// =====================================================
async function loadInitOptions() {
    try {
        const res = await fetch('/api/admin/init-options');
        const data = await res.json();
        initOptions = data.success ? data : null;
    } catch (e) { initOptions = null; console.error('옵션 로드 오류:', e); }
}

function fillRainSlotCheckboxes() {
    const area = document.getElementById('slot-checkbox-area');
    if (!area) return;
    const slots = (initOptions && initOptions.timeSlots) || [];
    if (slots.length === 0) {
        area.innerHTML = `<span style="font-size:0.85rem; color:#888;">등록된 회차가 없습니다. [⏰ 예약 일정/회차 설정] 탭에서 먼저 회차를 추가하세요.</span>`;
        return;
    }
    const values = [...new Set(slots.map(s => `${s.slot_name} (${s.start_time}~${s.end_time})`))];
    area.innerHTML = values.map(v => `<label><input type="checkbox" class="slot-checkbox" value="${escapeHtml(v)}"> ${escapeHtml(v)}</label>`).join('');
}

// =====================================================
// 5. 예약 내역 관리 콤보박스 (기존 동작 유지)
// =====================================================
function loadDynamicOptions() {
    const data = initOptions;
    if (!data) return;
    const siteName = projectName || data.siteName || '물놀이장';
    const locSelect = document.getElementById('filterLocation');
    const timeSelect = document.getElementById('filterTime');

    if (locSelect) {
        locSelect.innerHTML = '';
        if (data.locations && data.locations.length > 0) {
            data.locations.forEach(loc => { locSelect.innerHTML += `<option value="${escapeHtml(loc.name)}">[${escapeHtml(siteName)}] ${escapeHtml(loc.name)}</option>`; });
        } else {
            locSelect.innerHTML = `<option value="${escapeHtml(siteName)}">${escapeHtml(siteName)}</option>`;
        }
    }
    if (timeSelect) {
        timeSelect.innerHTML = '<option value="">모든 회차</option>';
        (data.timeSlots || []).forEach(slot => {
            timeSelect.innerHTML += `<option value="${escapeHtml(slot.slot_name)}">${escapeHtml(slot.slot_name)} (${slot.start_time}~${slot.end_time})</option>`;
        });
    }
}

// =====================================================
// 6. 예약 일정/회차 설정 (기존 로직 그대로)
// =====================================================
async function loadReserveSettings() {
    try {
        const res = await fetch('/api/admin/reserve-settings');
        const data = await res.json();
        if (!data.success) return;

        globalLocations = data.locations || [];
        let locOptions = '<option value="">장소 선택</option>';
        globalLocations.forEach(loc => { locOptions += `<option value="${loc.id}">${escapeHtml(loc.name)}</option>`; });

        ['slot-location-select', 'rule-location-select', 'notice-location-select'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = locOptions;
        });

        const locList = document.getElementById('location-list');
        if (locList) locList.innerHTML = globalLocations.map(loc => `<li style="padding:8px 0; color:#0056b3; font-weight:bold;">📍 ${escapeHtml(loc.name)}</li>`).join('');

        const slotList = document.getElementById('slot-list');
        if (slotList) slotList.innerHTML = (data.timeSlots || []).map(slot => `
            <li style="padding:10px; background:#fff; border:1px solid #eee; margin-bottom:5px; border-radius:4px; display:flex; justify-content:space-between;">
                <span>[${escapeHtml(slot.location_name)}] <strong>${escapeHtml(slot.slot_name)}</strong> (${slot.start_time}~${slot.end_time}) / 정원 ${slot.capacity}명</span>
                <button onclick="apiReserveSetting({action:'delete_slot', id:${slot.id}})" style="background:#dc3545; color:white; border:none; border-radius:4px; cursor:pointer; padding:5px 10px;">삭제</button>
            </li>`).join('');

        const ruleList = document.getElementById('rule-list');
        if (ruleList) ruleList.innerHTML = (data.rules || []).map(rule => `
            <li style="padding:10px; background:#fff; border:1px solid #eee; margin-bottom:5px; border-radius:4px; display:flex; justify-content:space-between;">
                <span>[${escapeHtml(rule.location_name)}] 이용일: ${rule.target_start_date} ~ ${rule.target_end_date} ➔ <strong>오픈: ${String(rule.open_datetime).replace('T', ' ')}</strong></span>
                <button onclick="apiReserveSetting({action:'delete_rule', id:${rule.id}})" style="background:#dc3545; color:white; border:none; border-radius:4px; cursor:pointer; padding:5px 10px;">삭제</button>
            </li>`).join('');
    } catch (e) { console.error(e); }
}

async function apiReserveSetting(payload) {
    try {
        const res = await fetch('/api/admin/reserve-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const result = await res.json();
        if (result.success) {
            alert('처리되었습니다!');
            loadReserveSettings();
            await loadInitOptions();
            fillRainSlotCheckboxes();
            loadDynamicOptions();
        } else { alert('오류 발생: ' + result.error); }
    } catch (e) { alert('서버 통신 오류'); }
}

function addLocation() {
    const name = document.getElementById('new-location-name').value.trim();
    if (!name) return alert('장소명을 입력하세요.');
    apiReserveSetting({ action: 'add_location', name });
    document.getElementById('new-location-name').value = '';
}
function addTimeSlot() {
    const loc_id = document.getElementById('slot-location-select').value;
    const name = document.getElementById('new-slot-name').value;
    const start = document.getElementById('new-slot-start').value;
    const end = document.getElementById('new-slot-end').value;
    const cap = document.getElementById('new-slot-capacity').value;
    if (!loc_id || !name || !start || !end || !cap) return alert('빈칸을 모두 채워주세요.');
    apiReserveSetting({ action: 'add_slot', location_id: loc_id, slot_name: name, start_time: start, end_time: end, capacity: cap });
}
function addReservationRule() {
    const loc_id = document.getElementById('rule-location-select').value;
    const start = document.getElementById('rule-start-date').value;
    const end = document.getElementById('rule-end-date').value;
    const open = document.getElementById('rule-open-datetime').value;
    if (!loc_id || !start || !end || !open) return alert('빈칸을 모두 채워주세요.');
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
    if (!loc_id) return alert('장소를 선택해주세요.');
    apiReserveSetting({ action: 'update_notice', location_id: loc_id, notice: text });
}

// 시작
document.addEventListener('DOMContentLoaded', loadTabs);
