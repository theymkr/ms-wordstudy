/* Reuse the tapped media element; failed playback never advances or grades. */
(() => {
  'use strict';
  const audio = new Audio(); audio.preload = 'auto';
  let watchdog = null, utterance = null, generation = 0;
  const previousStop = stop;
  stop = function () {
    generation++; clearTimeout(watchdog); watchdog = null;
    audio.onended = audio.onerror = audio.onplaying = null;
    audio.pause(); utterance = null;
    return previousStop.apply(this, arguments);
  };
  playWordPronunciation = function (word, id, onend, onerror) {
    const run = ++generation, rate = getPronunciationRate();
    let settled = false;
    const current = () => id === token && run === generation && !settled;
    const failed = message => {
      if (!current()) return;
      settled = true; clearTimeout(watchdog); audio.pause();
      if (utterance && window.speechSynthesis) speechSynthesis.cancel();
      utterance = null;
      if (onerror) onerror();
      // Keep the actionable explanation after the caller's generic error text.
      setAudioSourceStatus(message);
    };
    const finished = () => {
      if (!current()) return;
      settled = true; clearTimeout(watchdog); activeRecordedAudio = null; utterance = null;
      afterPronunciation(id,onend);
    };
    const speak = () => {
      if (!current()) return;
      if (!window.speechSynthesis) { failed('기기 음성을 사용할 수 없습니다. 녹음 다시 듣기를 누르세요.'); return; }
      const u = new SpeechSynthesisUtterance(word); utterance = u;
      u.lang = 'en-US'; u.rate = rate; u.pitch = 1; u.volume = 1;
      const voice = speechSynthesis.getVoices().find(v => v.lang === 'en-US'); if (voice) u.voice = voice;
      u.onstart = () => { if (!current()) return; clearTimeout(watchdog); setAudioSourceStatus('재생 중 · 기기 영어 음성'); watchdog = setTimeout(() => failed('재생이 멈췄습니다. 기기 음성으로 듣기를 다시 눌러 주세요.'),30000); };
      u.onend = finished;
      u.onerror = () => failed('기기 음성을 재생하지 못했습니다. 아래 듣기 버튼을 직접 누르고 미디어 음량도 확인해 주세요.');
      setAudioSourceStatus('기기 영어 음성 준비 중…');
      clearTimeout(watchdog); watchdog = setTimeout(() => failed('자동 재생이 시작되지 않았습니다. 기기 음성으로 듣기를 직접 눌러 주세요.'),7000);
      try { speechSynthesis.resume?.(); speechSynthesis.speak(u); } catch (_) { failed('기기 음성으로 듣기를 다시 눌러 주세요.'); }
    };
    const filename = activePronunciationSource === 'us' && usAudioFiles[String(word).toLowerCase()];
    if (!filename) { speak(); return; }
    audio.onended = finished;
    audio.onplaying = () => { if (!current()) return; clearTimeout(watchdog); setAudioSourceStatus('재생 중 · 미국식 원어민 녹음'); watchdog = setTimeout(() => failed('녹음 재생이 멈췄습니다. 아래 듣기 버튼을 다시 눌러 주세요.'),30000); };
    const fallback = () => { if (!current()) return; audio.pause(); audio.onerror = audio.onended = audio.onplaying = null; activeRecordedAudio = null; speak(); };
    audio.onerror = fallback;
    audio.src = '/audio-pilot/' + encodeURIComponent(filename); audio.muted = false; audio.volume = 1;
    audio.defaultPlaybackRate = rate; audio.playbackRate = rate; audio.preservesPitch = true;
    if ('webkitPreservesPitch' in audio) audio.webkitPreservesPitch = true;
    activeRecordedAudio = audio;
    setAudioSourceStatus('녹음 불러오는 중…');
    clearTimeout(watchdog); watchdog = setTimeout(fallback,8000);
    try {
      const promise = audio.play();
      promise?.catch(error => {
        if (!current()) return;
        if (error?.name === 'NotAllowedError') failed('자동 재생이 차단됐습니다. 발음 듣기를 직접 눌러 주세요. 계속 안 들리면 기기 음성으로 듣기를 누르세요.');
        else fallback();
      });
    } catch (_) { fallback(); }
  };
  window.YMPlaybackControls = function () {
    const status = document.getElementById('audioStatus') || document.getElementById('meaningAudioStatus');
    if (!status || document.getElementById('ymAudioRecovery')) return;
    const box = document.createElement('div'); box.id = 'ymAudioRecovery'; box.className = 'ym-audio-recovery';
    const device = document.createElement('button'); device.type = 'button'; device.textContent = '🔊 기기 음성으로 듣기';
    device.onclick = () => { activePronunciationSource = 'iphone'; mode === 'meaning' ? playMeaning() : play(); };
    box.append(device);
    if (!window.YMImportStudy?.currentSet()) {
      const recording = document.createElement('button'); recording.type = 'button'; recording.textContent = '🔊 녹음 다시 듣기';
      recording.onclick = () => { activePronunciationSource = 'us'; mode === 'meaning' ? playMeaning() : play(); }; box.append(recording);
    }
    status.after(box);
  };
})();
