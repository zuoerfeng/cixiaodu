(() => {
  for (const word of Object.keys(visualWords)) {
    visualWords[word].url = 'arasaac-audit/photos/' + word + (word === 'achievement' ? '.webp' : '.jpg');
  }
  const originalRenderVisual = renderVisual;
  renderVisual = function(word, holder) {
    const key = word.toLowerCase().trim().replace(/\s+/g, ' ');
    const ids = Object.hasOwn(window.ARASAAC_PICTOGRAMS || {}, key) ? window.ARASAAC_PICTOGRAMS[key] : [];
    const hasCustom = Object.hasOwn(customPictures, word);
    const hasCurated = Object.hasOwn(visualWords, word);
    holder.hidden = false;
    if (!ids.length && !hasCustom && !hasCurated) {
      holder.replaceChildren();
      holder.hidden = true;
      return;
    }
    if (hasCustom) {
      originalRenderVisual(word, holder);
      holder.querySelectorAll('figcaption, .image-add').forEach(node => node.remove());
      return;
    }
    if (!ids.length && hasCurated) {
      holder.replaceChildren();
      holder.append(sectionTitle('情境记忆'));
      const photo = visualWords[word];
      const figure = el('figure', undefined, 'word-figure');
      const image = el('img');
      image.src = photo.url;
      image.alt = photo.caption;
      image.loading = 'lazy';
      const error = el('div', '本地图片无法读取，请重新打开完整的词小读文件夹。', 'image-error');
      error.hidden = true;
      image.onerror = () => { image.hidden = true; error.hidden = false; };
      figure.append(image, error);
      holder.append(figure);
      return;
    }
    holder.replaceChildren();
    holder.append(sectionTitle('情境记忆'));
    const figure = el('figure', undefined, 'word-figure pictogram-figure');
    const image = el('img');
    image.alt = word + ' 的英文词条配图候选';
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    const error = el('div', '本地图示无法读取，请重新打开完整的词小读文件夹。', 'image-error');
    error.hidden = true;
    figure.append(image, error);
    holder.append(figure);
    function show() {
      image.hidden = false;
      error.hidden = true;
      image.src = 'arasaac-audit/images/' + ids[0] + '.png';
    }
    image.onerror = () => {
      image.hidden = true;
      error.hidden = false;
    };
    show();
  };
})();
