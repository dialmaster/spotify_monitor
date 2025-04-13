const Transcript = (() => {
  let elements = null;
  let ui = null;
  let ageEvaluation = null;
  let lyrics = null; // Reference to Lyrics module

  const initialize = (elementRefs, uiModule) => {
    elements = elementRefs;
    ui = uiModule;

    return {
      setAgeEvaluationModule: (ageEvalModule) => { ageEvaluation = ageEvalModule; },
      setLyricsModule: (lyricsModule) => { lyrics = lyricsModule; }
    };
  };

  return {
    initialize
  };
})();