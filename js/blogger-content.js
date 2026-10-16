// =====================================================
// Blogger 콘텐츠 공통 스크립트 (본문 + 팝업)
// 사용법: <body data-page="첫화면"> + <div id="kp-page-content"></div>
// 페이지 이름: 첫화면 / 운영기간안내 / 이용안내 / 예약하기 / 오시는길
// =====================================================
(function () {
    // ⭐️ Blogger 설정값 (라벨이 바뀌면 여기만 수정)
    var BLOG_URL = 'https://kny-company.blogspot.com';
    var SITE_LABEL = 'kny-kidsplay';

    var page = norm(document.body.getAttribute('data-page'));
    if (!page) return;

    injectStyle();

    loadFeed().then(function (entries) {
        renderContent(entries);
        renderPopups(entries);
    }).catch(function () {
        var box = document.getElementById('kp-page-content');
        if (box) box.innerHTML = '';
    });

    checkWeatherNotice();

    // ---------------- 공통 유틸 ----------------
    function norm(s) { return String(s || '').replace(/\s/g, ''); }
    function esc(s) {
        return String(s || '').replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function todayKst() {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    }
    function cleanText(node) { return node.nodeValue.replace(/\u00a0/g, ' ').trim(); }

    // 글자가 들어 있는 첫 번째 텍스트 조각 찾기
    function findTextNode(root, re) {
        var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        var n;
        while ((n = w.nextNode())) {
            var t = cleanText(n);
            if (!t) continue;
            if (!re || re.test(t)) return n;
            if (!re) return n;
        }
        return null;
    }

    // 한 줄 지우기 (뒤의 줄바꿈과 빈 칸까지 정리)
    function removeLine(root, node) {
        var parent = node.parentNode;
        var next = node.nextSibling;
        node.remove();
        if (next && next.nodeName === 'BR') next.remove();
        while (parent && parent !== root && !parent.textContent.trim() && !parent.querySelector('img,iframe')) {
            var p = parent.parentNode;
            parent.remove();
            parent = p;
        }
    }

    // Blogger 사진을 선명한 크기로 바꾸기 (화면 크기는 그대로)
    function sharpenImages(root) {
        root.querySelectorAll('img').forEach(function (img) {
            var src = img.getAttribute('src') || '';
            if (/blogger\.googleusercontent\.com|bp\.blogspot\.com/.test(src)) {
                img.setAttribute('src', src
                    .replace(/\/s\d+(-[a-z0-9-]+)?\//i, '/s1600/')
                    .replace(/=s\d+(-[a-z0-9-]+)?$/i, '=s1600')
                    .replace(/=w\d+-h\d+[^/]*$/i, '=s1600'));
            }
            img.setAttribute('loading', 'lazy');
        });
    }

    // ---------------- Blogger 불러오기 (JSONP) ----------------
    function loadFeed() {
        return new Promise(function (resolve, reject) {
            var cb = '__kpContentCb_' + Date.now();
            var s = document.createElement('script');
            window[cb] = function (data) {
                delete window[cb]; s.remove();
                var entries = ((data.feed && data.feed.entry) || [])
                    // ⭐️ 라벨이 정확히 kny-kidsplay인 글만 사용
                    .filter(function (e) {
                        return (e.category || []).some(function (c) { return c.term === SITE_LABEL; });
                    })
                    .map(function (e) {
                        return {
                            title: norm(e.title && e.title.$t),
                            html: (e.content && e.content.$t) || (e.summary && e.summary.$t) || '',
                            id: e.id.$t.split('.post-')[1],
                            updated: e.updated.$t
                        };
                    });
                resolve(entries);
            };
            s.onerror = function () { delete window[cb]; s.remove(); reject(); };
            s.src = BLOG_URL + '/feeds/posts/default/-/' + encodeURIComponent(SITE_LABEL) +
                '?alt=json-in-script&max-results=150&orderby=published&callback=' + cb + '&_=' + Date.now();
            document.body.appendChild(s);
        });
    }

    // ---------------- 본문 표시 ----------------
    function renderContent(entries) {
        var box = document.getElementById('kp-page-content');
        if (!box) return;

        // 같은 제목이 여러 개면 가장 최근 글 (피드가 최신순)
        var post = entries.find(function (e) { return e.title === page; });
        if (!post) { box.innerHTML = ''; return; }

        var div = document.createElement('div');
        div.innerHTML = post.html;
        sharpenImages(div);
        if (page === '오시는길') buildLocation(div);

        box.innerHTML = '';
        while (div.firstChild) box.appendChild(div.firstChild);
    }

    // 오시는길: "주소 : ..." 줄을 읽어 지도 이미지에 네이버 지도 링크 연결
    function buildLocation(div) {
        var node = findTextNode(div, /^주소\s*[:：]/);
        if (!node) return;
        var addr = cleanText(node).replace(/^주소\s*[:：]\s*/, '');
        if (!addr) return;
        var url = 'https://map.naver.com/p/search/' + encodeURIComponent(addr);

        var img = div.querySelector('img');
        if (img) {
            var a = img.closest('a');
            if (!a) {
                a = document.createElement('a');
                img.parentNode.insertBefore(a, img);
                a.appendChild(img);
            }
            a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.className = 'kp-map-link';
            var tip = document.createElement('div');
            tip.className = 'kp-map-tip';
            tip.textContent = '📍 지도를 누르면 네이버 지도가 열립니다';
            a.parentNode.insertBefore(tip, a.nextSibling);
        } else {
            var btn = document.createElement('a');
            btn.href = url; btn.target = '_blank'; btn.rel = 'noopener'; btn.className = 'kp-map-btn';
            btn.textContent = '📍 네이버 지도에서 보기';
            var block = node.parentNode === div ? node : node.parentNode;
            block.parentNode.insertBefore(btn, block.nextSibling);
        }
    }

    // ---------------- 팝업 ----------------
    function parsePopup(html) {
        var div = document.createElement('div');
        div.innerHTML = html;
        var node = findTextNode(div, null);
        if (!node) return null;
        var m = cleanText(node).match(/^노출위치\s*[:：]\s*(.+)$/);
        if (!m) return null;
        var targets = m[1].split(/[,，、]/).map(norm).filter(Boolean);
        removeLine(div, node);       // ⭐️ 노출위치 줄은 화면에서 지움
        sharpenImages(div);
        return { targets: targets, html: div.innerHTML };
    }

    function renderPopups(entries) {
        entries.filter(function (e) { return e.title === '팝업'; })
            .reverse() // 오래된 팝업을 먼저 깔고, 최신 팝업이 맨 위에 오도록
            .forEach(function (e) {
                var p = parsePopup(e.html);
                if (p && p.targets.indexOf(page) > -1) showPopup(e.id + '_' + e.updated, p.html);
            });
    }

    var popupCount = 0;
    function getOverlay() {
        var ov = document.getElementById('kp-popup-overlay');
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'kp-popup-overlay';
            document.body.appendChild(ov);
        }
        return ov;
    }

    function showPopup(key, html) {
        // '오늘 하루 보지않기'를 누른 팝업은 오늘 안 띄움 (글을 수정하면 다시 뜸)
        try { if (localStorage.getItem('kp_hide_' + key) === todayKst()) return; } catch (e) {}

        var ov = getOverlay();
        ov.style.display = 'block';

        popupCount++;
        var box = document.createElement('div');
        box.className = 'kp-popup';
        box.style.marginTop = ((popupCount - 1) * 24) + 'px';
        box.style.zIndex = 10000 + popupCount;
        box.innerHTML =
            '<div class="kp-popup-body"></div>' +
            '<div class="kp-popup-foot">' +
                '<button type="button" class="kp-today">오늘 하루 보지않기</button>' +
                '<button type="button" class="kp-close">닫기</button>' +
            '</div>';
        box.querySelector('.kp-popup-body').innerHTML = html;

        function close() {
            box.remove();
            if (!document.querySelector('.kp-popup')) ov.style.display = 'none';
        }
        box.querySelector('.kp-close').onclick = close;
        box.querySelector('.kp-today').onclick = function () {
            try { localStorage.setItem('kp_hide_' + key, todayKst()); } catch (e) {}
            close();
        };
        document.body.appendChild(box);
    }

    // ---------------- 우천/긴급 운영 중단 안내 (관리자 체크 시, 첫화면만) ----------------
    function checkWeatherNotice() {
        if (page !== '첫화면') return;
        var today = todayKst();
        fetch('/api/settings?date=' + today)
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) {
                if (!d || !d.success || !d.is_notice_active) return;
                var slots = (d.closed_slots || []).filter(Boolean);
                var html = '<h3 style="color:#dc3545; margin-top:0;">⚠️ 운영 안내</h3>' +
                    '<p>기상 악화 등의 사유로 오늘(' + today + ') 운영이 일부 중단되었습니다.</p>';
                if (slots.length) html += '<p><strong>중단 회차</strong><br>' + slots.map(esc).join('<br>') + '</p>';
                showPopup('weather_' + today, html);
            })
            .catch(function () {});
    }

    // ---------------- 스타일 ----------------
    function injectStyle() {
        if (document.getElementById('kp-content-style')) return;
        var st = document.createElement('style');
        st.id = 'kp-content-style';
        st.textContent =
            '#kp-page-content{max-width:1000px;margin:30px auto;padding:0 16px;line-height:1.8;word-break:keep-all;overflow-wrap:break-word;}' +
            '#kp-page-content img,.kp-popup img{max-width:100%!important;height:auto!important;}' +
            '#kp-page-content table{display:block;max-width:100%;overflow-x:auto;border-collapse:collapse;}' +
            '#kp-page-content iframe,.kp-popup iframe{max-width:100%;}' +
            '.kp-loading{text-align:center;color:#aaa;padding:80px 0;}' +
            '.kp-map-link{display:inline-block;cursor:pointer;}' +
            '.kp-map-tip{font-size:.9rem;color:#12b886;font-weight:bold;margin:6px 0 16px;}' +
            '.kp-map-btn{display:inline-block;margin:10px 0;padding:10px 18px;background:#03c75a;color:#fff!important;border-radius:6px;font-weight:bold;text-decoration:none;}' +
            '#kp-popup-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.55);z-index:9999;}' +
            '.kp-popup{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:92%;max-width:460px;background:#fff;border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.35);overflow:hidden;font-family:"Noto Sans KR",sans-serif;}' +
            '.kp-popup-body{padding:22px 20px;max-height:65vh;overflow-y:auto;line-height:1.7;word-break:keep-all;}' +
            '.kp-popup-foot{display:flex;border-top:1px solid #ddd;background:#f8f9fa;}' +
            '.kp-popup-foot button{padding:14px;border:none;background:none;font-size:1rem;font-weight:bold;color:#555;cursor:pointer;}' +
            '.kp-popup-foot .kp-today{flex:7;border-right:1px solid #ddd;}' +
            '.kp-popup-foot .kp-close{flex:3;}' +
            '.kp-popup-foot button:hover{background:#e9ecef;}';
        document.head.appendChild(st);
    }
})();
