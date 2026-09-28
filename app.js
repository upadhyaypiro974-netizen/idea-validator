const form = document.querySelector("#quiz-form");
const questions = [...document.querySelectorAll(".question")];
const stepBars = [...document.querySelectorAll(".steps span")];
const nextButton = document.querySelector("#next-button");
const backButton = document.querySelector("#back-button");
const restartButton = document.querySelector("#restart-button");
const results = document.querySelector("#results");
const checkoutDialog = document.querySelector("#checkout-dialog");
let currentStep = 1;

const asideContent = [
  ["Let’s understand the idea.", "Start with the simplest version—what are you making and for whom?"],
  ["Specific beats broad.", "A narrow first audience makes your message, product, and outreach clearer."],
  ["Is the pain frequent?", "Problems that happen often are easier for people to remember—and pay to solve."],
  ["Evidence changes everything.", "Real behavior is a stronger signal than compliments or personal excitement."],
  ["Look at today’s workaround.", "What people already use reveals both demand and your opening."],
  ["Distribution is part of the idea.", "A great product still needs a realistic route to its first users."]
];

const scoreMap = {
  frequency: { daily: 25, weekly: 19, monthly: 11, rarely: 4 },
  evidence: { paid: 25, interviews: 19, interest: 12, assumption: 3 },
  alternative: { painful: 15, expensive: 13, satisfied: 6, unknown: 4 },
  reach: { direct: 20, channel: 15, ideas: 9, unsure: 3 }
};

const copyMap = {
  frequency: {
    daily: ["High-frequency problem", "The pain appears often enough to stay top of mind."],
    weekly: ["Recurring problem", "Users are likely to notice this pain regularly."],
    monthly: ["Lower urgency", "The problem may need a sharper trigger or higher value."],
    rarely: ["Weak frequency", "People may delay solving a problem they rarely feel."]
  },
  evidence: {
    paid: ["Real buying behavior", "Money committed is your strongest demand signal."],
    interviews: ["User-backed pain", "Repeated interview patterns give the idea a credible base."],
    interest: ["Early attention", "Interest is useful, but needs a stronger commitment test."],
    assumption: ["Unproven demand", "The idea still depends mostly on what you believe users want."]
  },
  alternative: {
    painful: ["A broken workaround", "Manual or fragmented solutions create room for a better option."],
    expensive: ["A price opening", "Existing spend proves value and creates a clear comparison."],
    satisfied: ["Strong incumbents", "Happy users need a very clear reason to switch."],
    unknown: ["Unmapped market", "You need to learn what users currently choose and why."]
  },
  reach: {
    direct: ["Reachable first users", "You can test demand without waiting for a large audience."],
    channel: ["Visible distribution path", "You know where to start earning attention."],
    ideas: ["Uncertain acquisition", "A few possible channels need to become one repeatable route."],
    unsure: ["No route to users", "The first audience is defined, but not yet reachable."]
  }
};

function selected(name) {
  return form.querySelector(`input[name="${name}"]:checked`)?.value;
}

function updateStep(step) {
  currentStep = step;
  questions.forEach((question, index) => question.classList.toggle("active", index === step - 1));
  stepBars.forEach((bar, index) => bar.classList.toggle("active", index < step));
  document.querySelector("#step-label").textContent = `QUESTION ${step} OF 6`;
  document.querySelector("#aside-title").textContent = asideContent[step - 1][0];
  document.querySelector("#aside-copy").textContent = asideContent[step - 1][1];
  backButton.classList.toggle("hidden", step === 1);
  nextButton.innerHTML = step === 6 ? 'See my result <span aria-hidden="true">→</span>' : 'Continue <span aria-hidden="true">→</span>';
  const focusable = questions[step - 1].querySelector("textarea, input, label");
  window.setTimeout(() => focusable?.focus({ preventScroll: true }), 120);
}

function validateStep(step) {
  if (step === 1 || step === 2) {
    const id = step === 1 ? "idea" : "audience";
    const input = document.querySelector(`#${id}`);
    const error = document.querySelector(`#${id}-error`);
    const min = step === 1 ? 15 : 3;
    if (input.value.trim().length < min) {
      error.textContent = step === 1 ? "Add a little more detail about the idea." : "Tell us who this is for.";
      input.focus();
      return false;
    }
    error.textContent = "";
    return true;
  }
  const name = ["", "", "frequency", "evidence", "alternative", "reach"][step - 1];
  const error = document.querySelector(`#${name}-error`);
  if (!selected(name)) {
    error.textContent = "Choose the closest answer to continue.";
    return false;
  }
  error.textContent = "";
  return true;
}

function calculateResult() {
  const answers = {
    frequency: selected("frequency"),
    evidence: selected("evidence"),
    alternative: selected("alternative"),
    reach: selected("reach")
  };
  const idea = document.querySelector("#idea").value.trim();
  const audience = document.querySelector("#audience").value.trim();
  const clarity = Math.min(15, 8 + Math.floor(idea.split(/\s+/).length / 3) + (audience.split(/\s+/).length >= 3 ? 3 : 0));
  const dimensions = Object.entries(answers).map(([name, value]) => ({ name, value, score: scoreMap[name][value], copy: copyMap[name][value] }));
  const total = Math.min(100, clarity + dimensions.reduce((sum, item) => sum + item.score, 0));
  const strongest = [...dimensions].sort((a, b) => b.score / Math.max(...Object.values(scoreMap[b.name])) - a.score / Math.max(...Object.values(scoreMap[a.name])))[0];
  const weakest = [...dimensions].sort((a, b) => a.score / Math.max(...Object.values(scoreMap[a.name])) - b.score / Math.max(...Object.values(scoreMap[b.name])))[0];

  let verdict;
  if (total >= 78) verdict = ["Strong signal", `Your idea shows promising fundamentals for ${audience}. Keep testing before you invest heavily.`];
  else if (total >= 58) verdict = ["Worth testing", `There is enough signal to keep exploring—but one assumption needs proof before you build.`];
  else if (total >= 38) verdict = ["Needs evidence", `The idea may work for ${audience}, but the current case relies on several untested assumptions.`];
  else verdict = ["Pause and learn", `Don’t build yet. A few focused conversations can reveal whether this problem deserves a solution.`];

  const tests = {
    evidence: ["Run five problem interviews", `Ask five ${audience} about the last time this problem happened. Do not pitch—listen for repeated pain and existing spend.`],
    frequency: ["Find the urgent moment", `Ask ${audience} when this problem becomes impossible to ignore. Build your first offer around that exact trigger.`],
    alternative: ["Map three alternatives", `Find three ways ${audience} solves this today. Note what they pay, tolerate, and complain about.`],
    reach: ["Build a 20-person prospect list", `Choose one community or platform and identify 20 ${audience} you can personally contact this week.`]
  };

  document.querySelector("#score-value").textContent = total;
  document.querySelector("#score-ring").style.setProperty("--score", total);
  document.querySelector("#result-title").textContent = verdict[0];
  document.querySelector("#result-summary").textContent = verdict[1];
  document.querySelector("#idea-recap").textContent = idea;
  document.querySelector("#strength-title").textContent = strongest.copy[0];
  document.querySelector("#strength-copy").textContent = strongest.copy[1];
  document.querySelector("#risk-title").textContent = weakest.copy[0];
  document.querySelector("#risk-copy").textContent = weakest.copy[1];
  document.querySelector("#test-title").textContent = tests[weakest.name][0];
  document.querySelector("#test-copy").textContent = tests[weakest.name][1];
}

function showResults() {
  calculateResult();
  form.classList.add("hidden");
  results.classList.remove("hidden");
  restartButton.classList.remove("hidden");
  document.querySelector("#step-label").textContent = "PERSONALIZED RESULT";
  document.querySelector("#aside-title").textContent = "Your clearest next move.";
  document.querySelector("#aside-copy").textContent = "A score is only useful when it tells you what to test next.";
  stepBars.forEach(bar => bar.classList.add("active"));
  results.scrollIntoView({ behavior: "smooth", block: "center" });
}

nextButton.addEventListener("click", () => {
  if (!validateStep(currentStep)) return;
  if (currentStep < 6) updateStep(currentStep + 1);
  else showResults();
});
backButton.addEventListener("click", () => updateStep(Math.max(1, currentStep - 1)));

form.addEventListener("keydown", event => {
  if (event.key === "Enter" && event.target.tagName !== "TEXTAREA") {
    event.preventDefault();
    nextButton.click();
  }
});

["idea", "audience"].forEach(id => {
  const input = document.querySelector(`#${id}`);
  const counter = document.querySelector(`#${id}-count`);
  input.addEventListener("input", () => {
    counter.textContent = `${input.value.length} / ${input.maxLength}`;
    document.querySelector(`#${id}-error`).textContent = "";
  });
});

document.querySelectorAll('input[type="radio"]').forEach(input => {
  input.addEventListener("change", () => {
    document.querySelector(`#${input.name}-error`).textContent = "";
    window.setTimeout(() => {
      if (currentStep < 6) updateStep(currentStep + 1);
    }, 260);
  });
});

restartButton.addEventListener("click", () => {
  form.reset();
  document.querySelector("#idea-count").textContent = "0 / 220";
  document.querySelector("#audience-count").textContent = "0 / 90";
  results.classList.add("hidden");
  form.classList.remove("hidden");
  restartButton.classList.add("hidden");
  updateStep(1);
});

document.querySelectorAll("[data-start]").forEach(button => button.addEventListener("click", () => {
  document.querySelector("#validator").scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => document.querySelector("#idea").focus({ preventScroll: true }), 600);
}));

document.querySelector("#upgrade-button").addEventListener("click", () => checkoutDialog.showModal());
document.querySelector("#dialog-close").addEventListener("click", () => checkoutDialog.close());
document.querySelector("#dialog-done").addEventListener("click", () => checkoutDialog.close());
checkoutDialog.addEventListener("click", event => {
  if (event.target === checkoutDialog) checkoutDialog.close();
});

updateStep(1);
