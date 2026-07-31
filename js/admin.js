document.addEventListener('DOMContentLoaded', async () => {

    const reservationList = document.getElementById('reservationList');
    
    // ⭐️ 요약 박스 엘리먼트 가져오기
    const totalBookedEl = document.getElementById('totalBookedCount');
    const totalCanceledEl = document.getElementById('totalCanceledCount');

    // 필터 엘리먼트들
    const searchInput = document.getElementById('searchInput');
    const filterLocation = document.getElementById('filterLocation');
    const filterDate = document.getElementById('filterDate');
    const filterTime = document.getElementById('filterTime');

    // ⭐️ [신규 추가] 운영 설정(우천 휴장) 엘리먼트들
    const settingDateInput = document.getElementById('settingDate');
    const noticeActiveCheckbox = document.getElementById('noticeActive');
    const slotCheckboxes = document.querySelectorAll('.slot-checkbox');
    const btnSaveSettings = document.getElementById('btnSaveSettings');
    
    // API 서버 주소
    const API_BASE = 'https://kny-kidsplay.tonycho999.workers.dev';
    const GET_URL = `${API_BASE}/api/reservations`;
    const UPDATE_URL = `${API_BASE}/api/update-status`;
    const SETTINGS_URL = `${API_BASE}/api/settings`;

    let allReservations = []; 

    function getStatusStyle(status) {
        if (status === '예약완료') {
            return 'background-color: #28a745; color: white; border: none; padding: 6px; border-radius: 4px; font-weight: bold; cursor: pointer; outline: none;';
        } else if (status === '예약취소') {
            return 'background-color: #dc3545; color: white; border: none; padding: 6px; border-radius: 4px; font-weight: bold; cursor: pointer; outline: none;';
        } else {
            return 'background-color: #ffffff; color: #333; border: 1px solid #ccc; padding: 5px; border-radius: 4px; font-weight: bold; cursor: pointer; outline: none;';
        }
    }

    function renderTable(dataToRender) {
        reservationList.innerHTML = ''; 
        
        // 1. 화면 렌더링 시 인원 합산용 변수 초기화
        let sumBooked = 0;
        let sumCanceled = 0;

        if (dataToRender.length === 0) {
            reservationList.innerHTML = '<tr><td colspan="6">일치하는 예약 내역이 없습니다.</td></tr>';
            if(totalBookedEl) totalBookedEl.textContent = '0';
            if(totalCanceledEl) totalCanceledEl.textContent = '0';
            return;
        }

        dataToRender.forEach(item => {
            const currentStatus = item.status || '예약대기';
            
            // 2. 상태별로 인원수 합산
            const peopleCount = parseInt(item.people) || 0;
            if (currentStatus === '예약취소') {
                sumCanceled += peopleCount;
            } else {
                sumBooked += peopleCount;
            }

            const row = document.createElement('tr');
            
            // 단일 장소로 뱃지 통일
            const locationBadge = `<span style="background:#0056b3; color:white; padding:3px 6px; border-radius:3px; font-size:0.8em; margin-bottom:5px; display:inline-block; font-weight:bold;">${item.location}</span><br>`;
            const dateTimeStr = `${locationBadge}<strong>${item.date}</strong><br><span style="font-size:0.85em; color:#666;">${item.time_slot}</span>`;
            const userInfoStr = `<strong>${item.name}</strong> (${item.phone})<br><span style="font-size:0.85em; color:#666;">${item.email} / ${item.birthdate}</span>`;

            row.innerHTML = `
                <td>${dateTimeStr}</td>
                <td style="font-family: monospace; font-weight: bold; color: #0056b3;">${item.reservation_code || '-'}</td>
                <td style="text-align:left;">${userInfoStr}</td>
                <td style="text-align:left; font-size:0.9em; max-width:250px; word-break:keep-all;">${item.address || '-'}</td>
                <td>${item.people}명</td>
                <td>
                    <select class="status-select" data-id="${item.id}" style="${getStatusStyle(currentStatus)}">
                        <option value="예약대기" style="background:#fff; color:#333;" ${currentStatus === '예약대기' ? 'selected' : ''}>예약대기</option>
                        <option value="예약완료" style="background:#fff; color:#333;" ${currentStatus === '예약완료' ? 'selected' : ''}>예약완료</option>
                        <option value="예약취소" style="background:#fff; color:#333;" ${currentStatus === '예약취소' ? 'selected' : ''}>예약취소</option>
                    </select>
                </td>
            `;
            reservationList.appendChild(row);
        });

        // 3. 합산된 결과를 요약 박스에 반영
        if(totalBookedEl) totalBookedEl.textContent = sumBooked;
        if(totalCanceledEl) totalCanceledEl.textContent = sumCanceled;

        attachSelectListeners();
    }

    function attachSelectListeners() {
        document.querySelectorAll('.status-select').forEach(selectElement => {
            selectElement.addEventListener('change', async (e) => {
                const reservationId = e.target.getAttribute('data-id');
                const newStatus = e.target.value;
                try {
                    const updateRes = await fetch(UPDATE_URL, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: reservationId, status: newStatus })
                    });
                    
                    if (updateRes.ok) {
                        const itemToUpdate = allReservations.find(item => item.id == reservationId);
                        if (itemToUpdate) itemToUpdate.status = newStatus;
                        
                        // 상태 변경 시 전체 화면을 재렌더링하여 인원 요약 박스도 즉시 갱신
                        applyFilters();
                    } else {
                        alert('상태 변경에 실패했습니다.');
                        location.reload(); 
                    }
                } catch (error) {
                    alert('네트워크 오류가 발생했습니다.');
                    location.reload();
                }
            });
        });
    }

    function applyFilters() {
        const keyword = searchInput.value.toLowerCase().trim();
        const loc = filterLocation.value;
        const date = filterDate.value;
        const time = filterTime.value;

        const filteredData = allReservations.filter(item => {
            const matchKeyword = 
                (item.name && item.name.toLowerCase().includes(keyword)) || 
                (item.phone && item.phone.includes(keyword)) ||
                (item.reservation_code && item.reservation_code.toLowerCase().includes(keyword));
                
            const matchLoc = loc === "" || item.location.includes(loc);
            const matchDate = date === "" || item.date === date;
            const matchTime = time === "" || item.time_slot.includes(time);

            return matchKeyword && matchLoc && matchDate && matchTime;
        });

        renderTable(filteredData);
    }

    [searchInput, filterLocation, filterDate, filterTime].forEach(el => {
        if(el) el.addEventListener('input', applyFilters);
    });

    // ==========================================
    // ⭐️ [신규 추가] 운영 설정(우천 휴장) 연동 로직
    // ==========================================
    
    // 1. 날짜 변경 시 서버에서 설정 불러오기
    async function loadSettings() {
        if (!settingDateInput) return;
        const dateStr = settingDateInput.value;
        if (!dateStr) return;

        try {
            const res = await fetch(`${SETTINGS_URL}?date=${dateStr}&location=성북문화바캉스`);
            const data = await res.json();
            
            if (res.ok && data.success) {
                noticeActiveCheckbox.checked = data.is_notice_active;
                slotCheckboxes.forEach(cb => {
                    cb.checked = data.closed_slots.includes(cb.value);
                });
            } else {
                noticeActiveCheckbox.checked = false;
                slotCheckboxes.forEach(cb => cb.checked = false);
            }
        } catch (error) {
            console.error('설정 불러오기 실패:', error);
        }
    }

    if (settingDateInput) {
        settingDateInput.addEventListener('change', loadSettings);
    }

    // 2. 설정 저장 버튼 클릭
    if (btnSaveSettings) {
        btnSaveSettings.addEventListener('click', async () => {
            const dateStr = settingDateInput.value;
            if (!dateStr) return alert('설정할 날짜를 먼저 선택해주세요!');

            const isNoticeActive = noticeActiveCheckbox.checked;
            const closedSlots = Array.from(slotCheckboxes)
                                    .filter(cb => cb.checked)
                                    .map(cb => cb.value);

            btnSaveSettings.textContent = '저장 중...';
            btnSaveSettings.disabled = true;

            try {
                const res = await fetch(SETTINGS_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        target_date: dateStr,
                        location: '성북문화바캉스',
                        is_notice_active: isNoticeActive,
                        closed_slots: closedSlots
                    })
                });

                const data = await res.json();
                if (res.ok && data.success) {
                    alert(`✅ ${dateStr} 운영 설정이 성공적으로 저장되었습니다!`);
                } else {
                    alert('❌ 설정 저장에 실패했습니다.');
                }
            } catch (error) {
                alert('네트워크 오류가 발생했습니다.');
            } finally {
                btnSaveSettings.textContent = '설정 저장';
                btnSaveSettings.disabled = false;
            }
        });
    }

    // ⭐️ 데이터 로딩 및 초기화
    try {
        const response = await fetch(GET_URL);
        const data = await response.json();
        allReservations = data;
        renderTable(allReservations);
    } catch (error) {
        reservationList.innerHTML = '<tr><td colspan="6">데이터를 불러오는 데 실패했습니다.</td></tr>';
    }

    // 초기 진입 시 오늘 날짜로 설정 세팅
    if (settingDateInput) {
        const today = new Date();
        const offset = today.getTimezoneOffset() * 60000;
        const dateLocal = (new Date(today - offset)).toISOString().split('T')[0];
        settingDateInput.value = dateLocal;
        loadSettings(); 
    }
});
