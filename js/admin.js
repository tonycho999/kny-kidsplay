document.addEventListener('DOMContentLoaded', async () => {
    const reservationList = document.getElementById('reservationList');
    
    // 필터 엘리먼트들
    const searchInput = document.getElementById('searchInput');
    const filterLocation = document.getElementById('filterLocation');
    const filterDate = document.getElementById('filterDate');
    const filterTime = document.getElementById('filterTime');
    
    // ⭐️ 새 서버 주소 적용
    const GET_URL = 'https://kny-kidsplay.tonycho999.workers.dev/api/reservations';
    const UPDATE_URL = 'https://kny-kidsplay.tonycho999.workers.dev/api/update-status';

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

        if (dataToRender.length === 0) {
            reservationList.innerHTML = '<tr><td colspan="6">일치하는 예약 내역이 없습니다.</td></tr>';
            return;
        }

        dataToRender.forEach(item => {
            const row = document.createElement('tr');
            const currentStatus = item.status || '예약대기';

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
                        
                        e.target.style.cssText = getStatusStyle(newStatus);
                        alert('상태가 변경되었습니다.');
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

    try {
        const response = await fetch(GET_URL);
        const data = await response.json();
        allReservations = data;
        renderTable(allReservations);
    } catch (error) {
        reservationList.innerHTML = '<tr><td colspan="6">데이터를 불러오는 데 실패했습니다.</td></tr>';
    }
});
