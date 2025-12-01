document.addEventListener('DOMContentLoaded', () => {
    function fixText(s){
        const str = String(s||'');
        const hasMojibake = /[ØÙÂÃ]/.test(str);
        if(!hasMojibake) return str;
        try { return decodeURIComponent(escape(str)); } catch(_){ }
        try {
            const bytes = new Uint8Array([...str].map(ch=>ch.charCodeAt(0)));
            return new TextDecoder('utf-8').decode(bytes);
        } catch(_){ }
        return str;
    }
    const MAINTENANCE_MODE = false; // فعّل/عطّل وضع الصيانة من هنا
    window.NOVA_MAINTENANCE = MAINTENANCE_MODE;
    const WHATSAPP_NUMBER = (() => {
        const p = window.location.pathname;
        if (p.includes('hy-alhusin-sfry.html')) return '07736427608'; // حي الحسين
        if (p.includes('hy-elz-sfry.html')) return '96407751000803';     // جامعة الزهراء
        if (p.includes('hy-wars-sfry.html')) return '07751000804';    // جامعة الوارث
        return '07736427608'; // افتراضي
    })();
    const SHIPPING_COST = 2000; // القيمة الافتراضية لفروع أخرى، وسيتم تعيينها 0 تلقائياً في صفحة hy-alhusin-sfry عند الحساب
    const ALHUSIN_DELIVERY_PER_ITEM = 500; // رسوم 500 د.ع لكل قطعة عند التوصيل لعنوان في حي الحسين

    // استثناءات رسوم التوصيل لكل قطعة (لا تُحسب هذه الفئات ضمن 500 د.ع لكل قطعة)
    const EXCLUDED_CATEGORIES = new Set(['المخبوزات','مخبوزات','مخبوز','الايس كريم','آيس كريم','ايس كريم','ساندويش','ساندويشات']);

    // تساعد في تحديد فئة المنتج الذي تم الضغط على زر + الخاص به
    function getItemCategory(button) {
        try {
            // ابحث عن أقرب حاوية قسم
            const container = button.closest('.category-container');
            if (container) {
                const headerEl = container.querySelector('.category-header h2, .category-header .font-bold, .category-header');
                let txt = headerEl ? (headerEl.textContent || '') : '';
                txt = txt.replace(/\s+/g, ' ').trim();
                if (txt) return fixText(txt);
            }
            // fallback: جلب العنوان من الهيدر السابق لحاوية العناصر
            const items = button.closest('.category-items');
            if (items && items.previousElementSibling && items.previousElementSibling.classList.contains('category-header')) {
                const h = items.previousElementSibling.querySelector('h2, .font-bold') || items.previousElementSibling;
                const t = (h.textContent || '').trim();
                if (t) return t;
            }
            // fallback أخير
            const anyHeader = document.querySelector('.category-header h2, .category-header .font-bold');
            return anyHeader ? (anyHeader.textContent || '').trim() : 'غير مصنف';
        } catch (_) {
            return 'غير مصنف';
        }
    }

    // Accordion Functionality (event delegation)
    document.addEventListener('click', (evt) => {
        const header = evt.target.closest('.category-header');
        if (!header) return;
        const itemsContainer = header.nextElementSibling;
        const icon = header.querySelector('.chevron-icon');
        const isOpening = itemsContainer ? !itemsContainer.classList.contains('open') : false;
        document.querySelectorAll('.category-items.open').forEach(openContainer => {
            openContainer.classList.remove('open');
            const prevIcon = openContainer.previousElementSibling && openContainer.previousElementSibling.querySelector('.chevron-icon');
            prevIcon && prevIcon.classList.remove('rotate-180');
        });
        if (itemsContainer && isOpening) {
            itemsContainer.classList.add('open');
            icon && icon.classList.add('rotate-180');
            const onOpened = (e) => {
                if (e.propertyName === 'max-height') {
                    itemsContainer.removeEventListener('transitionend', onOpened);
                    itemsContainer.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
                }
            };
            itemsContainer.addEventListener('transitionend', onOpened);
        }
    });

    // Cart and Modal Functionality
    // Add-to-cart via event delegation to support dynamic items
    const cartButtonContainer = document.getElementById('cart-button-container');
    const cartButton = document.getElementById('cart-button');
    const cartCountElement = document.getElementById('cart-count');
    const modal = document.getElementById('cart-modal');
    const modalContent = modal.querySelector('.modal-content');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cartItemsContainer = document.getElementById('cart-items-container');
    const subtotalEl = document.getElementById('subtotal');
    const totalEl = document.getElementById('total');
    const orderForm = document.getElementById('order-form');

    let cart = {}; // Use an object to handle quantities
    let audioCtx = null; // For Safari/iOS haptic-like audio fallback

    // Custom add sound (plays on +)
    const ADD_SOUND_SRC = 'sound/mixkit-video-game-mystery-alert-234.wav';
    let addSound = null;
    const USE_CUSTOM_ADD_SOUND = true;
    function playAddSound() {
        try {
            if (!addSound) {
                addSound = new Audio(ADD_SOUND_SRC);
                addSound.preload = 'auto';
                addSound.volume = 0.35; // adjust loudness if needed
            }
            const audioToPlay = addSound.paused ? addSound : addSound.cloneNode();
            audioToPlay.currentTime = 0;
            audioToPlay.play().catch(() => {});
        } catch (_) { /* ignore */ }
    }

    function openModal() {
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            modalContent.classList.remove('opacity-0', '-translate-y-10');
        }, 10);
    }

    function closeModal() {
        modal.classList.add('opacity-0');
        modalContent.classList.add('opacity-0', '-translate-y-10');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    }

    cartButton.addEventListener('click', openModal);
    closeModalBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Haptic + cart shake feedback when an item is added
    function triggerCartFeedback() {
        try {
            if ('vibrate' in navigator) {
                navigator.vibrate([20, 30, 20]);
            } else {
                throw new Error('Vibration API not available');
            }
        } catch (_) {
            // If custom sound is enabled, we skip the tiny click fallback to avoid double sound
            if (!USE_CUSTOM_ADD_SOUND) {
                // Safari/iOS fallback: very short click sound via Web Audio
                try {
                    if (!audioCtx) {
                        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    }
                    if (audioCtx.state === 'suspended') {
                        audioCtx.resume();
                    }
                    const ctx = audioCtx;
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    // A tiny "tock" sound
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(140, ctx.currentTime);
                    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.005);
                    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.03);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start();
                    osc.stop(ctx.currentTime + 0.035);
                } catch (__){ /* ignore */ }
            }
        }
        if (!cartButton) return;
        // restart animation if it was running
        cartButton.classList.remove('cart-shake');
        void cartButton.offsetWidth; // force reflow to re-trigger
        cartButton.classList.add('cart-shake');
    }
    // Ensure class is cleaned after animation so it can trigger again next time
    cartButton && cartButton.addEventListener('animationend', () => {
        cartButton.classList.remove('cart-shake');
    });

    document.addEventListener('click', (event) => {
        const button = event.target.closest('.add-to-cart-btn');
        if (!button) return;
        event.stopPropagation();
        const name = fixText(button.dataset.name);
        const price = parseFloat(button.dataset.price);
        const category = fixText(getItemCategory(button));
        if(cart[name]) {
            cart[name].quantity++;
            if (!cart[name].category) cart[name].category = category;
        } else {
            cart[name] = { price, quantity: 1, note: '', noteOpen: true, category };
        }
        updateCart();
        playAddSound();
        setTimeout(triggerCartFeedback, 30);
    });

    function updateCart() {
        cartItemsContainer.innerHTML = ''; // Clear current items
        let subtotal = 0;
        let totalItems = 0;
        let eligibleItemCount = 0; // عدد القطع المؤهلة لرسوم 500
        const itemNames = Object.keys(cart);

        if (itemNames.length === 0) {
            cartItemsContainer.innerHTML = '<p class="text-center text-gray-500">لا يوجد منتجات في سلتك بعد.</p>';
        } else {
            itemNames.forEach(name => {
                const item = cart[name];
                subtotal += item.price * item.quantity;
                totalItems += item.quantity;
                // احتساب العناصر المؤهلة حسب الفئة مع مراعاة الكمية
                const cat = (item.category || '').trim();
                if (!EXCLUDED_CATEGORIES.has(cat)) {
                    eligibleItemCount += item.quantity;
                }
                
                if (typeof item.note !== 'string') item.note = '';
                // إزالة الاعتماد على noteOpen لأننا سنعرض حقل الملاحظة دائماً
                // if (typeof item.noteOpen !== 'boolean') item.noteOpen = false;

                const itemElement = document.createElement('div');
                itemElement.className = 'cart-item w-full border-b pb-2';
                itemElement.dataset.name = name;
                const noteVal = item.note.replace(/"/g, '&quot;');
                itemElement.innerHTML = `
                    <div class="flex justify-between items-center text-sm">
                        <div>
                            <p class="font-bold">${name}</p>
                            <p class="text-xs text-gray-500">${item.price.toLocaleString()} IQD</p>
                        </div>
                        <div class="flex items-center">
                            <button class="quantity-btn px-2 py-1" data-name="${name}" data-action="decrease">-</button>
                            <span class="px-2">${item.quantity}</span>
                            <button class="quantity-btn px-2 py-1" data-name="${name}" data-action="increase">+</button>
                            <!-- أزلنا زر الملاحظة لأنه لم يعد مطلوباً -->
                            <button class="remove-item-btn text-red-500 hover:text-red-700 p-1" data-name="${name}">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    </div>
                    <div class="mt-1 item-note-row">
                        <input type="text" class="item-note-input w-full border rounded px-2 py-1 text-xs" value="${noteVal}">
                    </div>
                `;
                cartItemsContainer.appendChild(itemElement);
            });
        }
        
        if (subtotalEl) {
            subtotalEl.textContent = `${subtotal.toLocaleString()} IQD`;
        }
        const effectiveShipping = (window.location.pathname.includes('hy-alhusin-sfry.html') || window.location.pathname.includes('hy-wars-sfry.html') || window.location.pathname.includes('hy-elz-sfry.html')) ? 0 : SHIPPING_COST;
        const currentOrderType = fixText(document.querySelector('input[name="order-type"]:checked')?.value || '');
        const perItemDeliveryFee = (window.location.pathname.includes('hy-alhusin-sfry.html') && currentOrderType === 'توصيل للعنوان')
            ? eligibleItemCount * ALHUSIN_DELIVERY_PER_ITEM
            : 0;
        // إظهار/إخفاء ملاحظة رسوم 500 د.ع لكل عنصر حسب نوع الطلب (فرع حي الحسين فقط)
        const feeNoteEl = document.getElementById('per-item-fee-note');
        if (feeNoteEl) {
            if (window.location.pathname.includes('hy-alhusin-sfry.html') && currentOrderType === 'توصيل للعنوان') {
                feeNoteEl.classList.remove('hidden');
            } else {
                feeNoteEl.classList.add('hidden');
            }
        }
        totalEl && (totalEl.textContent = `${(subtotal + effectiveShipping + perItemDeliveryFee).toLocaleString()} IQD`);
        cartCountElement.textContent = totalItems;

        if (totalItems > 0) {
            cartButtonContainer.classList.remove('hidden');
        } else {
            cartButtonContainer.classList.add('hidden');
        }
    }

    cartItemsContainer.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        const name = target.dataset.name;
        let shouldFeedback = false;

        if (target.classList.contains('quantity-btn')) {
            const action = target.dataset.action;
            if (action === 'increase') {
                cart[name].quantity++;
                shouldFeedback = true;
            } else if (action === 'decrease') {
                cart[name].quantity--;
                if (cart[name].quantity <= 0) {
                    delete cart[name];
                }
            }
        // أزلنا فرع زر الملاحظة لأنه لم يعد موجوداً
        } else if (target.classList.contains('remove-item-btn')) {
            delete cart[name];
        }
        updateCart();
        if (shouldFeedback) { playAddSound(); setTimeout(triggerCartFeedback, 30); }
    });

    // Persist item note edits
    cartItemsContainer.addEventListener('input', (e) => {
        const input = e.target.closest('.item-note-input');
        if (!input) return;
        const wrapper = input.closest('.cart-item');
        const name = wrapper && wrapper.dataset.name;
        if (name && cart[name]) {
            cart[name].note = input.value;
        }
    });
    
    // Enhance radio UI and dynamic required fields based on order type
    const nameInput = document.getElementById('customer-name');
    const phoneInput = document.getElementById('customer-phone');
    const addressInput = document.getElementById('customer-address');
    const carTypeInput = document.getElementById('customer-car-type');
    const carColorInput = document.getElementById('customer-car-color');

    function setOrderFieldsByType(type) {
        const nameWrapper = nameInput && nameInput.closest('div');
        const phoneWrapper = phoneInput && phoneInput.closest('div');
        const addressWrapper = addressInput && addressInput.closest('div');
        const carTypeWrapper = carTypeInput ? carTypeInput.closest('div') : null;
        const carColorWrapper = carColorInput ? carColorInput.closest('div') : null;

        // Reset visibility
        [nameWrapper, phoneWrapper, addressWrapper, carTypeWrapper, carColorWrapper].forEach(el => el && el.classList.add('hidden'));
        // Reset required flags
        if (nameInput) nameInput.required = false;
        if (phoneInput) phoneInput.required = false;
        if (addressInput) addressInput.required = false;
        if (carTypeInput) carTypeInput.required = false;
        if (carColorInput) carColorInput.required = false;

        if (type === 'استلام داخل الفرع') {
            // اسم + رقم فقط
            [nameWrapper, phoneWrapper].forEach(el => el && el.classList.remove('hidden'));
            if (nameInput) nameInput.required = true;
            if (phoneInput) phoneInput.required = true;
        } else if (type === 'توصيل للعنوان') {
            // اسم + رقم + عنوان
            [nameWrapper, phoneWrapper, addressWrapper].forEach(el => el && el.classList.remove('hidden'));
            if (nameInput) nameInput.required = true;
            if (phoneInput) phoneInput.required = true;
            if (addressInput) addressInput.required = true;
        } else if (type === 'Drive-Thru') {
            // اسم + رقم + نوع/لون السيارة
            [nameWrapper, phoneWrapper, carTypeWrapper, carColorWrapper].forEach(el => el && el.classList.remove('hidden'));
            if (nameInput) nameInput.required = true;
            if (phoneInput) phoneInput.required = true;
            if (carTypeInput) carTypeInput.required = true;
            if (carColorInput) carColorInput.required = true;
        } else {
            // Fallback: أظهر الاسم والرقم فقط
            [nameWrapper, phoneWrapper].forEach(el => el && el.classList.remove('hidden'));
            if (nameInput) nameInput.required = true;
            if (phoneInput) phoneInput.required = true;
        }
    }

    const orderTypeRadios = document.querySelectorAll('input[name="order-type"]');
    orderTypeRadios.forEach(r => {
        r.addEventListener('change', () => {
            setOrderFieldsByType(r.value);
            refreshRadioStyles('order-type');
            updateCart(); // تحديث الإجمالي عند تغيير نوع الطلب
        });
        r.classList.add('h-4','w-4','align-middle','text-purple-600','focus:ring-purple-500','cursor-pointer');
    });
    
    function refreshRadioStyles(groupName) {
        document.querySelectorAll(`input[name="${groupName}"]`).forEach(inp => {
            const lbl = inp.parentElement;
            if (inp.checked) {
                lbl.classList.add('border-purple-500','bg-purple-50');
            } else {
                lbl.classList.remove('border-purple-500','bg-purple-50');
            }
        });
    }

    const initialType = document.querySelector('input[name="order-type"]:checked')?.value || 'استلام داخل الفرع';
    setOrderFieldsByType(initialType);
    refreshRadioStyles('order-type');

    // Style radio groups labels to look more professional
    document.querySelectorAll('label > input[type="radio"]').forEach(input => {
        const parentLabel = input.parentElement;
        parentLabel.classList.add('inline-flex','items-center','gap-2','py-1.5','px-2.5','rounded-md','border','border-gray-200','hover:border-gray-300');
    });
    // Apply style to payment-type radios and selected state
    const paymentTypeRadios = document.querySelectorAll('input[name="payment-type"]');
    paymentTypeRadios.forEach(r => {
        r.addEventListener('change', () => refreshRadioStyles('payment-type'));
        r.classList.add('h-4','w-4','align-middle','text-purple-600','focus:ring-purple-500','cursor-pointer');
    });
    refreshRadioStyles('payment-type');

    // ICE CREAM NOVA (Scoops) logic: packs 3/5, counter, remaining text, add to cart
    const icSection = document.getElementById('ice-cream-section');
    if (icSection) {
        const pack3Btn = document.getElementById('ic-pack-3');
        const pack5Btn = document.getElementById('ic-pack-5');
        const counterEl = document.getElementById('ic-counter');
        const remainingEl = document.getElementById('ic-remaining');
        const resetBtn = document.getElementById('ic-reset-btn');
        const addBtn = document.getElementById('ic-add-btn');
        const hiddenAddBtn = document.getElementById('ic-hidden-add');
        const flavorsContainer = document.getElementById('ic-flavors');

        const PRICE = { 3: 3000, 5: 5000 };
        let packSize = 3; // default
        const counts = {};
        document.querySelectorAll('#ic-flavors .ic-count').forEach(span => {
            const raw = span.dataset.flavor;
            const key = fixText(raw);
            counts[key] = 0;
        });

        function sumSelected() { return Object.values(counts).reduce((a, b) => a + b, 0); }

        function applyActiveRing() {
            [pack3Btn, pack5Btn].forEach(b => b && b.classList.remove('ring-amber-600', 'ring-2'));
            const active = packSize === 3 ? pack3Btn : pack5Btn;
            active && active.classList.add('ring-2', 'ring-amber-600');
        }

        function resetSelection() {
            Object.keys(counts).forEach(k => counts[k] = 0);
            // reflect 0s in DOM
            document.querySelectorAll('#ic-flavors .ic-count').forEach(span => {
                span.textContent = '0';
            });
            updateUI();
        }

        function setPackSize(size) {
            if (packSize === size) return;
            packSize = size;
            applyActiveRing();
            // reset when switching pack for clarity
            resetSelection();
        }

        function updateUI() {
            const total = sumSelected();
            if (counterEl) counterEl.textContent = `${total}/${packSize}`;
            const remaining = Math.max(packSize - total, 0);
            if (remainingEl) {
                remainingEl.textContent = remaining > 0
                    ? (remaining === 1 ? 'بقي لك 1 اختيار' : `بقي لك ${remaining} اختيارات`)
                    : 'جاهز للإضافة';
            }
            if (addBtn) addBtn.disabled = (total !== packSize);
        }

        // Event bindings
        pack3Btn && pack3Btn.addEventListener('click', () => setPackSize(3));
        pack5Btn && pack5Btn.addEventListener('click', () => setPackSize(5));
        resetBtn && resetBtn.addEventListener('click', resetSelection);

        // Delegate + / - within section
        icSection.addEventListener('click', (e) => {
            const btn = e.target.closest('.ic-qty-btn');
            if (!btn) return;
            const action = btn.dataset.action;
            const flavorRaw = btn.dataset.flavor;
            const flavor = fixText(flavorRaw);
            const currentTotal = sumSelected();

            if (action === 'inc') {
                if (currentTotal >= packSize) {
                    // feedback only, no increment beyond limit
                    playAddSound();
                    setTimeout(triggerCartFeedback, 30);
                    return;
                }
                counts[flavor] = (counts[flavor] || 0) + 1;
            } else if (action === 'dec') {
                counts[flavor] = Math.max((counts[flavor] || 0) - 1, 0);
            }

            // reflect single changed counter in DOM quickly
            const span = flavorsContainer.querySelector(`.ic-count[data-flavor="${CSS.escape(flavorRaw)}"]`);
            if (span) span.textContent = counts[flavor];
            updateUI();
        });

        // Compose item and add to cart via hidden button to reuse existing cart logic
        addBtn && addBtn.addEventListener('click', () => {
            if (sumSelected() !== packSize) return;
            const parts = Object.keys(counts)
                .filter(f => counts[f] > 0)
                .map(f => `${f} x${counts[f]}`);
            const name = `ICE CREAM NOVA — ${packSize} Scoops: ${parts.join('، ')}`;
            hiddenAddBtn.dataset.name = name;
            hiddenAddBtn.dataset.price = PRICE[packSize];
            hiddenAddBtn.click();
            // reset after adding
            resetSelection();
        });

        // Initial UI sync
        applyActiveRing();
        updateUI();
    }

    // Call button action
    const callButton = document.getElementById('call-button');
    if (callButton) {
        callButton.addEventListener('click', (e) => {
            e.preventDefault();
            // اتصل مباشرةً برقم الفرع دائمًا
            const phoneVal = WHATSAPP_NUMBER;
            window.location.href = `tel:${phoneVal}`;
        });
    }

    // Copy payment numbers (e.g., Zain cash / Qi Card) when clicking the copy icon
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-copy]');
        if (!btn) return;
        e.preventDefault();
        const value = btn.getAttribute('data-copy') || '';
        if (!value) return;
        copyTextToClipboard(value)
            .then(() => showCopyFeedback(btn))
            .catch(() => showCopyFeedback(btn)); // حتى في حال فشل النسخ نظهر تغذية راجعة بسيطة
    });

    function copyTextToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        // Fallback للاجهزة/المتصفحات القديمة
        return new Promise((resolve, reject) => {
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.setAttribute('readonly', '');
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                const ok = document.execCommand('copy');
                document.body.removeChild(ta);
                ok ? resolve() : reject();
            } catch (err) { reject(err); }
        });
    }

    function showCopyFeedback(btn) {
        const originalHTML = btn.innerHTML;
        const originalClasses = btn.className;
        btn.className = originalClasses + ' text-green-600 hover:bg-green-100';
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.className = originalClasses;
        }, 1200);
    }

    // Submit handler to send WhatsApp message
    orderForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const customerName = document.getElementById('customer-name').value.trim();
        const customerPhone = document.getElementById('customer-phone').value.trim();
        const customerAddress = document.getElementById('customer-address').value.trim();
        const carType = (document.getElementById('customer-car-type')?.value || '').trim();
        const carColor = (document.getElementById('customer-car-color')?.value || '').trim();
        const orderType = fixText(document.querySelector('input[name="order-type"]:checked').value);
        const paymentType = fixText(document.querySelector('input[name="payment-type"]:checked').value);
        const generalNotes = (document.getElementById('general-notes')?.value || '').trim();

        if(Object.keys(cart).length === 0) {
            alert("سلة الطلبات فارغة!");
            return;
        }

        let subtotal = 0;
        let itemsList = '';
        let totalQuantity = 0;
        let eligibleQuantity = 0; // عدد القطع المؤهلة لرسوم 500
        Object.keys(cart).forEach(name => {
            const item = cart[name];
            subtotal += item.price * item.quantity;
            totalQuantity += item.quantity;
            const cat = (item.category || '').trim();
            if (!EXCLUDED_CATEGORIES.has(cat)) {
                eligibleQuantity += item.quantity;
            }
            itemsList += `${item.quantity} x ${name} _____ ${(item.price * item.quantity).toLocaleString()} د.ع\n`;
            if (item.note && item.note.trim()) {
                itemsList += `↳ ملاحظة: ${item.note.trim()}\n`;
            }
        });

        const effectiveShipping = (window.location.pathname.includes('hy-alhusin-sfry.html') || window.location.pathname.includes('hy-wars-sfry.html') || window.location.pathname.includes('hy-elz-sfry.html')) ? 0 : SHIPPING_COST;
        const perItemDeliveryFee = (window.location.pathname.includes('hy-alhusin-sfry.html') && orderType === 'توصيل للعنوان')
            ? eligibleQuantity * ALHUSIN_DELIVERY_PER_ITEM
            : 0;
        const total = subtotal + effectiveShipping + perItemDeliveryFee;
         const orderId = Math.floor(100000 + Math.random() * 900000);

         let message = `📌 *طلب جديد: ${orderId}*\n\n`;
         message += itemsList;
         message += `\n———————————\n`;
         // تم إخفاء تفاصيل المجموع الفرعي والشحن بناءً على طلبك
         if (perItemDeliveryFee > 0) {
             message += `رسوم التوصيل (500 د.ع/قطعة): ${perItemDeliveryFee.toLocaleString()} د.ع\n`;
         }
         message += `================\n`;
         message += `*المجموع: ${total.toLocaleString()} د.ع*\n`;
         message += `================\n\n`;
         message += `*معلومات الزبون*\n`;
        message += `- الاسم: ${customerName}\n`;
        message += `- الرقم: ${customerPhone}\n`;
        if (orderType === 'توصيل للعنوان') message += `- عنوان: ${customerAddress}\n\n`; else message += `\n`;
        message += `- نوع الطلب: ${orderType}\n`;
        if (orderType === 'Drive-Thru') {
            message += `- نوع السيارة: ${carType || 'غير محدد'}\n`;
            message += `- لون السيارة: ${carColor || 'غير محدد'}\n`;
        }
        message += `- نوع عملية الشراء: ${paymentType}\n`;
        if (generalNotes) {
            message += `- ملاحظات عامة: ${generalNotes}\n`;
        }
        
        const localNumber = WHATSAPP_NUMBER.replace(/\D/g, '');
        let waNumber = localNumber;
        if (waNumber.startsWith('964')) {
            // الرقم بالفعل دولي
        } else if (waNumber.startsWith('0')) {
            waNumber = '964' + waNumber.slice(1);
        }
        const whatsappUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');

        // Clear cart and form after submission
        cart = {};
        orderForm.reset();
        updateCart();
        closeModal();
    });
});
