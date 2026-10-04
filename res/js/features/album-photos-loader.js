(function () {
'use strict';

const Hb = window.Handlebars;

const emptyStateTpl = Hb.compile(
    `<div class="content_page_error">
        <img class="icon" src="{{icon_src}}" alt="{{empty_text}}" loading="lazy"/>
        <span class="text">
            <div class="description">{{empty_text}}</div>
        </span>
    </div>`
);

const yearDelimiterTpl = Hb.compile(
    `<div class="photos_period_delimiter photos_period_delimiter_{{year}}" data-year="{{year}}">{{year}}</div>`
);

const photoElementTpl = Hb.compile(
    `<div class="album-photo masonry-item scroll_node" data-photo-id="{{id}}">
        <a href="/photo{{id}}" onclick="PhotoViewer.openById('{{viewer_id}}', event)">
            <img class="album-photo--image" src="{{url_small}}" alt="{{description}}" loading="lazy">
        </a>
    </div>`
);

vkify.once("initAlbumPhotosLoader", () => {
    window.initAlbumPhotosLoader = function () {
        const photosSection = ge('photos-section');
        if (!photosSection || photosSection.dataset.initialized === 'true') {
            photosSection && vkify.log('Photo loader already initialized, skipping');
            return;
        }

        photosSection.dataset.initialized = 'true';

        const ownerId = parseInt(document.querySelector('[data-owner-id]')?.dataset.ownerId);
        if (!ownerId) return;

        const CONFIG = {
            PHOTOS_PER_LOAD: 20,
            TIMEOUT_MS: 10000,
            SCROLL_MARGIN: '0px 0px 200px 0px'
        };

        const state = {
            photosLoaded: 0,
            totalPhotos: 0,
            isLoadingMore: false,
            detachAutoLoader: null
        };

        const elements = {
            container: ge('photos-container'),
            loading: ge('photos-loading'),
            showMoreContainer: ge('photos-show-more-container'),
            showMoreBtn: ge('photos-show-more-btn'),
            headerCount: document.querySelector('#photos-section .page_block_header_count')
        };

        const hasMorePhotos = () => state.totalPhotos > 0 && state.photosLoaded < state.totalPhotos;

        const isSystemPhoto = (photo) => photo.system === 1 || photo.system === true;

        const createEmptyState = () => {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = emptyStateTpl({
                icon_src: vkify.resourceUrl('icons/no_posts.png'),
                empty_text: tr('is_x_photos_zero')
            });
            return wrapper.firstElementChild;
        };

        const groupPhotosByYear = (photos) => {
            const byYear = {};
            photos.forEach(photo => {
                if (isSystemPhoto(photo)) return;
                const year = new Date(photo.date * 1000).getFullYear();
                if (!byYear[year]) byYear[year] = [];
                byYear[year].push({
                    id: `${photo.owner_id}_${photo.id}`,
                    viewer_id: `${photo.owner_id}_${photo.id}${photo.access_key ? '_' + photo.access_key : ''}`,
                    url_small: photo.src_big || photo.src,
                    url_large: photo.src_xbig || photo.src_big || photo.src,
                    description: photo.text || '',
                    date: photo.date
                });
            });
            Object.values(byYear).forEach(arr => arr.sort((a, b) => b.date - a.date));
            return byYear;
        };

        const createYearSection = (year) => {
            const periodDiv = document.createElement('div');
            periodDiv.className = 'photo_period page_padding';
            periodDiv.dataset.year = year;

            const delimiterWrap = document.createElement('div');
            delimiterWrap.innerHTML = yearDelimiterTpl({ year });
            const delimiter = delimiterWrap.firstElementChild;

            const container = document.createElement('div');
            container.className = 'scroll_container album-flex';
            container.id = `photos-year-${year}`;

            periodDiv.append(delimiter, container);
            return { periodDiv, container };
        };

        const createPhotoElement = (photo) => {
            const wrap = document.createElement('div');
            wrap.innerHTML = photoElementTpl(photo);
            return wrap.firstElementChild;
        };

        const insertYearSection = (periodDiv, year) => {
            const existingPeriods = Array.from(elements.container.querySelectorAll('.photo_period'));
            const inserted = existingPeriods.some((period, i) => {
                if (year > parseInt(period.dataset.year)) {
                    elements.container.insertBefore(periodDiv, period);
                    return true;
                }
                return false;
            });
            if (!inserted) elements.container.appendChild(periodDiv);
        };

        const renderPhotos = (photosByYear) => {
            Object.entries(photosByYear).forEach(([year, photos]) => {
                let yearContainer = ge(`photos-year-${year}`);
                if (!yearContainer) {
                    const { periodDiv, container } = createYearSection(year);
                    insertYearSection(periodDiv, parseInt(year));
                    yearContainer = container;
                }
                photos.forEach(photo => yearContainer.appendChild(createPhotoElement(photo)));
            });
        };

        const updateHeaderCount = (count) => {
            if (elements.headerCount) {
                elements.headerCount.textContent = count;
                elements.headerCount.style.display = 'inline';
            }
        };

        const showEmptyState = () => {
            elements.loading.style.display = 'none';
            elements.container.innerHTML = '';
            elements.container.appendChild(createEmptyState());
            photosSection.style.display = 'block';
        };

        const showError = (message) => {
            elements.loading.innerHTML = message;
            photosSection.style.display = 'block';
        };

        const initMasonry = () => {
            window.Masonry?.initAll('.album-flex', {
                itemSelector: '.masonry-item',
                columns: 3,
                gap: 10,
                breakpoints: { 600: 2, 450: 1 }
            });
        };

        const fetchPhotos = async (offset) => {
            try {
                return await window.OVKAPI.call('photos.getAll', {
                    owner_id: ownerId,
                    photo_sizes: 1,
                    count: CONFIG.PHOTOS_PER_LOAD,
                    offset: offset
                });
            } catch (apiError) {
                console.error('OVKAPI failed:', apiError);
                return null;
            }
        };

        const loadPhotos = async (offset = 0) => {
            vkify.log('Loading photos with offset:', offset);

            const photos = await fetchPhotos(offset);
            if (!photos) return;

            if (offset === 0) {
                state.totalPhotos = photos.count;
                elements.loading.style.display = 'none';

                if (state.totalPhotos === 0 || !photos.items?.length) {
                    showEmptyState();
                    return;
                }

                elements.container.innerHTML = '';
                state.photosLoaded = 0;
                photosSection.style.display = 'block';
                updateHeaderCount(state.totalPhotos);
            }

            if (photos.items?.length > 0) {
                const photosByYear = groupPhotosByYear(photos.items);
                renderPhotos(photosByYear);
                state.photosLoaded += photos.items.length;
                initMasonry();
            }

            updateShowMoreVisibility();
        };

        const handleLoadMore = async (button = null) => {
            if (state.isLoadingMore || !hasMorePhotos()) {
                updateShowMoreVisibility();
                return;
            }

            state.isLoadingMore = true;
            const runLoad = () => loadPhotos(state.photosLoaded);

            if (elements.showMoreContainer) {
                elements.showMoreContainer.style.display = 'block';
            }

            try {
                if (button) {
                    button.disabled = true;
                    await LoaderUtils.withAsyncButton(button, runLoad);
                } else {
                    await runLoad();
                }
            } catch (error) {
                console.error('Error loading more photos:', error);
            } finally {
                if (button) button.disabled = false;
                state.isLoadingMore = false;
                updateShowMoreVisibility();
            }
        };

        const createIntersectionObserver = () => {
            let wasIntersecting = false;
            let readyToTrigger = true;

            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        if (readyToTrigger && !state.isLoadingMore) {
                            readyToTrigger = false;
                            handleLoadMore(elements.showMoreBtn);
                        }
                        wasIntersecting = true;
                    } else if (wasIntersecting) {
                        readyToTrigger = true;
                        wasIntersecting = false;
                    }
                });
            }, { root: null, rootMargin: CONFIG.SCROLL_MARGIN, threshold: 0 });

            observer.observe(elements.showMoreContainer);
            return () => observer.disconnect();
        };

        const createScrollFallback = () => {
            let wasVisible = false;
            let readyToTrigger = true;

            const onScroll = () => {
                const rect = elements.showMoreContainer.getBoundingClientRect();
                const isVisible = rect.top <= window.innerHeight + 200 && rect.bottom >= 0;

                if (isVisible) {
                    if (readyToTrigger && !state.isLoadingMore) {
                        readyToTrigger = false;
                        handleLoadMore(elements.showMoreBtn);
                    }
                    wasVisible = true;
                } else if (wasVisible) {
                    readyToTrigger = true;
                    wasVisible = false;
                }
            };

            window.addEventListener('scroll', onScroll, { passive: true });
            return () => window.removeEventListener('scroll', onScroll);
        };

        const ensureAutoLoadHook = () => {
            if (!elements.showMoreContainer || state.detachAutoLoader) return;

            state.detachAutoLoader = 'IntersectionObserver' in window
                ? createIntersectionObserver()
                : createScrollFallback();
        };

        const removeAutoLoadHook = () => {
            if (state.detachAutoLoader) {
                state.detachAutoLoader();
                state.detachAutoLoader = null;
            }
        };

        const updateShowMoreVisibility = () => {
            if (!elements.showMoreContainer) return;

            if (hasMorePhotos()) {
                elements.showMoreContainer.style.display = 'block';
                ensureAutoLoadHook();
            } else {
                elements.showMoreContainer.style.display = 'none';
                removeAutoLoadHook();
            }
        };

        const init = async () => {
            try {
                await Promise.race([
                    loadPhotos(0),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout')), CONFIG.TIMEOUT_MS)
                    )
                ]);
            } catch (error) {
                console.error('Failed to load initial photos:', error);
                showError(tr('unable_to_load_queue'));
            }
        };

        elements.showMoreBtn?.addEventListener('click', () => handleLoadMore(elements.showMoreBtn));

        init();
    };
});

})();
