document.addEventListener('DOMContentLoaded', () => {

    // === ⭐️ 성북문화바캉스 운영 정책 설정 ===
    const RULES = {
        "성북문화바캉스": {
            start: "2026-07-31",
            end: "2026-08-09",
            closedDays: [], // 휴장일 없음
            exceptions: [], 
            capacity: 200,   // 정원 설정 (필요시 변경)
            slots: [
                "1부 (10:00~13:00)", 
                "2부 (14:00~17:00)"
            ]
        }
    };

    const API_BASE = 'https://kny-summerdb.tonycho999.workers.dev';

    let currentYear = 2026;
    let currentMonth = 7;
    
    // 단일 장소 고정
    let selectedLocation = "성북문화바캉스";

    const calendarBody = document.getElementById('calendarBody');
    const currentMonthDisplay = document.getElementById('currentMonth');
    const timeListContainer = document.getElementById('timeList');
    const selectedDateDisplay = document.getElementById('selectedDateDisplay');
    const hiddenDateInput = document.getElementById('date');

    function renderDefaultTimeSlots() {
        const rule = RULES[selectedLocation];
        if (!rule) return;

        timeListContainer.innerHTML = ''; 
        rule.slots.forEach(slot => {
            const label = document.createElement('label');
            label.className = 'time-item disabled'; 
            label.innerHTML = `
                <input type="radio" name="timeSlot" value="${slot}" disabled>
                <span style="color:#999;">
                    ${slot} <br>
                    <small>(날짜를 먼저 선택해주세요)</small>
                </span>
            `;
            timeListContainer.appendChild(label);
        });
    }

    // === 주차별 예약 오픈 스케줄 반영 로직 ===
    function isSelectable(dateStr, rule) {
        const [y, m, d] = dateStr.split('-').map(Number);
        const targetDate = new Date(y, m - 1, d, 0, 0, 0);
        
        const start = new Date(rule.start);
        const end = new Date(rule.end);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        
        if (targetDate < start || targetDate > end) return false;
        if (!rule.exceptions?.includes(dateStr) && rule.closedDays.includes(targetDate.getDay())) return false;

        // 예약 오픈 시간 설정 (하루 전 20:00)
        const openTime = new Date(targetDate);
        openTime.setDate(openTime.getDate() - 1); 
        openTime.setHours(20, 0, 0, 0);           
        
        // 예약 마감 시간 설정 (당일 00:00)
        const closeTime = new Date(targetDate);
        closeTime.setHours(0, 0, 0, 0);

        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Seoul',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        });
        const parts = formatter.formatToParts(new Date());
        const kst = {};
        parts.forEach(p => kst[p.type] = p.value);
        const currentKst = new Date(kst.year, kst.month - 1, kst.day, kst.hour, kst.minute, kst.second);
        
        if (currentKst < openTime || currentKst >= closeTime) return false;

        const currentOnlyDate = new Date(kst.year, kst.month - 1, kst.day, 0, 0, 0);
        if (currentOnlyDate > targetDate) return false;

        return true; 
    }

    function renderCalendar(year, month) {
        calendarBody.innerHTML = '';
        currentMonthDisplay.textContent = `${year}년 ${month}월`;
        
        const stepDesc = document.querySelector('.calendar-table').nextElementSibling;
        if (stepDesc) {
            stepDesc.innerHTML = `원하시는 날짜를 선택하세요.<br><span style="color:#0056b3; font-weight:bold; font-size:0.9em;">(⏰ 예약 오픈: 이용 전날 20:00 ~ 자정까지)</span>`;
        }
        
        const firstDay = new Date(year, month - 1, 1).getDay();
        const lastDate = new Date(year, month, 0).getDate();
        const rule = RULES[selectedLocation];

        let date = 1;
        for (let i = 0; i < 6; i++) {
            const row = document.createElement('tr');
            for (let j = 0; j < 7; j++) {
                const cell = document.createElement('td');
                if (i === 0 && j < firstDay) { } 
                else if (date > lastDate) { } 
                else {
                    cell.textContent = date;
                    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
                    
                    if (isSelectable(dateStr, rule)) {
                        cell.style.cursor = 'pointer';
                        cell.addEventListener('click', () => handleDateClick(cell, dateStr));
                    } else {
                        cell.classList.add('disabled');
                        cell.title = '아직 예약이 오픈되지 않았거나 예약 불가한 날짜입니다.\n(오픈 시간: 이용 전날 20:00 ~ 자정까지)';
                    }
                    date++;
                }
                row.appendChild(cell);
            }
            calendarBody.appendChild(row);
            if (date > lastDate) break;
        }
    }

    document.getElementById('prevMonth').addEventListener('click', () => {
        if (currentMonth === 1) { currentMonth = 12; currentYear--; } else { currentMonth--; }
        renderCalendar(currentYear, currentMonth);
    });
    document.getElementById('nextMonth').addEventListener('click', () => {
        if (currentMonth === 12) { currentMonth = 1; currentYear++; } else { currentMonth++; }
        renderCalendar(currentYear, currentMonth);
    });

    async function handleDateClick(cell, dateStr) {
        document.querySelectorAll('#calendarBody td').forEach(td => td.classList.remove('selected'));
        cell.classList.add('selected');
        
        hiddenDateInput.value = dateStr;
        selectedDateDisplay.textContent = dateStr; 
        
        timeListContainer.innerHTML = '<p style="text-align:center; padding:20px; color:#666;">잔여 인원 조회 중...</p>';

        const rule = RULES[selectedLocation];
        
        try {
            const response = await fetch(`${API_BASE}/api/capacity?location=${encodeURIComponent(selectedLocation)}&date=${dateStr}`);
            const bookedData = await response.json();
            
            const bookedMap = {};
            bookedData.forEach(item => {
                bookedMap[item.time_slot] = item.booked;
            });

            timeListContainer.innerHTML = ''; 
            
            rule.slots.forEach(slot => {
                const bookedCount = bookedMap[slot] || 0;
                const remainCount = rule.capacity - bookedCount;
                const isFull = remainCount <= 0;

                const label = document.createElement('label');
                label.className = `time-item ${isFull ? 'disabled' : ''}`;
                
                label.innerHTML = `
                    <input type="radio" name="timeSlot" value="${slot}" ${isFull ? 'disabled' : ''}>
                    <span style="${isFull ? 'color:#dc3545; text-decoration:line-through;' : ''}">
                        ${slot} <br>
                        <small style="color:${isFull ? '#dc3545' : '#28a745'}">
                            (잔여: ${isFull ? '마감' : remainCount + '명'} / 정원: ${rule.capacity}명)
                        </small>
                    </span>
                `;
                timeListContainer.appendChild(label);
            });

        } catch (error) {
            timeListContainer.innerHTML = '<p style="color:red; text-align:center;">데이터를 불러오는 데 실패했습니다.</p>';
            renderDefaultTimeSlots(); 
        }
    }

    renderCalendar(currentYear, currentMonth);
    renderDefaultTimeSlots();

    const btnMinus = document.getElementById('btnMinus');
    const btnPlus = document.getElementById('btnPlus');
    const peopleInput = document.getElementById('people');

    if(btnMinus && btnPlus) {
        btnMinus.addEventListener('click', () => { let val = parseInt(peopleInput.value); if (val > 1) peopleInput.value = val - 1; });
        btnPlus.addEventListener('click', () => { let val = parseInt(peopleInput.value); if (val < 5) peopleInput.value = val + 1; });
    }

    const reserveForm = document.getElementById('reserveForm');
    if (reserveForm) {
        reserveForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!hiddenDateInput.value) return alert('달력에서 예약 날짜를 선택해주세요.');
            const timeSlot = document.querySelector('input[name="timeSlot"]:checked');
            if (!timeSlot) return alert('예약 시간을 선택해주세요.');
            
            // ==========================================
            // ⭐️ 성북구민 주소 검증 로직으로 수정
            // ==========================================
            const address1 = document.getElementById('address1').value;
            if (!address1.includes('성북')) {
                alert('죄송합니다. 성북문화바캉스는 성북구민만 예약이 가능합니다.\n올바른 성북구 주소를 입력해 주세요.');
                return;
            }

            const agree = document.getElementById('privacyAgree');
            if (!agree.checked) return alert('개인정보 수집 및 이용에 동의해주세요.');

            const submitBtn = reserveForm.querySelector('.submit-btn');
            submitBtn.textContent = '예약 처리 중...';
            submitBtn.disabled = true;

            const email = `${document.getElementById('email1').value}@${document.getElementById('email2').value}`;
            const phone = `${document.getElementById('phone1').value}-${document.getElementById('phone2').value}-${document.getElementById('phone3').value}`;
            const birthdate = `${document.getElementById('birthYear').value}-${document.getElementById('birthMonth').value}-${document.getElementById('birthDay').value}`;
            const address = `[${document.getElementById('postcode').value}] ${document.getElementById('address1').value} ${document.getElementById('address2').value}`;

            const data = {
                location: selectedLocation,
                name: document.getElementById('name').value,
                phone: phone,
                people: parseInt(peopleInput.value),
                date: hiddenDateInput.value,
                time_slot: timeSlot.value,
                email: email,
                birthdate: birthdate,
                address: address
            };

            try {
                const response = await fetch(`${API_BASE}/api/reserve`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json(); 
                
                if (response.ok && result.success) {
                    const formContainer = reserveForm.parentElement;
                    formContainer.innerHTML = `
                        <div style="text-align: center; padding: 2rem; background: #f8f9fa; border-radius: 8px; border: 1px solid #ddd; margin-top: 1rem;">
                            <h3 style="color: #28a745; margin-bottom: 1rem;">🎉 예약이 성공적으로 접수되었습니다!</h3>
                            <p style="color: #666; margin-bottom: 1rem;">추후 예약 조회/취소 시 필요하오니 아래 예약 번호를 반드시 복사해 두세요.</p>
                            
                            <div style="margin: 1.5rem auto; padding: 1rem; background: #fff; border: 2px dashed #0056b3; font-size: 1.8rem; font-weight: bold; color: #0056b3; width: 80%; letter-spacing: 2px;">
                                ${result.reservation_code}
                            </div>
                            
                            <button type="button" onclick="navigator.clipboard.writeText('${result.reservation_code}').then(() => alert('예약 번호가 복사되었습니다!'))" class="btn-black" style="padding: 10px 20px; font-size: 1rem; margin-bottom: 1.5rem; cursor: pointer;">
                                📋 예약 번호 복사하기
                            </button>
                            <br>
                            <button type="button" onclick="location.reload()" class="submit-btn" style="width: auto; padding: 10px 30px;">확인 (초기화)</button>
                        </div>
                    `;
                    formContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    alert(`예약 처리 중 오류가 발생했습니다: \n${result.message || result.error || '알 수 없는 오류'}`);
                    submitBtn.textContent = '예약 신청하기';
                    submitBtn.disabled = false;
                }
            } catch (error) {
                alert('네트워크 오류가 발생했습니다.');
                submitBtn.textContent = '예약 신청하기';
                submitBtn.disabled = false;
            }
        });
    }
});
