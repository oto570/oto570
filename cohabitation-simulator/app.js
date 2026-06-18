// 同棲生活費シミュレーター
// タイムライン: idx0=2026年6月(ボーナス準備) idx1=2026年7月(初期費用支払い) idx2-25=2026年8月〜2028年7月(同棲24ヶ月)

const SEASONAL_MULTIPLIER = {
  1: 1.30, 2: 1.25, 3: 1.05, 4: 0.90, 5: 0.85, 6: 0.85,
  7: 1.10, 8: 1.20, 9: 1.00, 10: 0.85, 11: 0.95, 12: 1.20
};

const START_YEAR = 2026;
const START_MONTH = 6; // June
const TIMELINE_LENGTH = 26; // 2026/06 - 2028/07
const BONUS_CAL_MONTHS = [6, 12];

function yen(n) {
  return "¥" + Math.round(n).toLocaleString("ja-JP");
}

function buildTimeline() {
  const months = [];
  let y = START_YEAR, m = START_MONTH;
  for (let i = 0; i < TIMELINE_LENGTH; i++) {
    months.push({ idx: i, year: y, month: m, label: `${y}/${String(m).padStart(2, "0")}` });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

const TIMELINE = buildTimeline();

function readInputs() {
  const num = (id) => parseFloat(document.getElementById(id).value) || 0;
  const splitMode = document.querySelector('input[name="splitMode"]:checked').value;

  return {
    userSalary: num("userSalary"),
    partnerSalary: num("partnerSalary"),
    userBonus: num("userBonus"),
    partnerBonus: num("partnerBonus"),
    rent: num("rent"),
    rentSubsidy: num("rentSubsidy"),
    deposit: num("deposit"),
    keyMoney: num("keyMoney"),
    guaranteeFee: num("guaranteeFee"),
    fireInsurance: num("fireInsurance"),
    keyExchange: num("keyExchange"),
    cleaningFee: num("cleaningFee"),
    acCleaningFee: num("acCleaningFee"),
    agencyFee: num("agencyFee"),
    furnitureMoveCost: num("furnitureMoveCost"),
    electricityBase: num("electricityBase"),
    gasBase: num("gasBase"),
    waterBase: num("waterBase"),
    foodCost: num("foodCost"),
    dailyNecessities: num("dailyNecessities"),
    parkingCost: num("parkingCost"),
    nhkFee: num("nhkFee"),
    splitMode,
    customRatio: num("customRatio"),
    bufferTargetMonths: num("bufferTargetMonths"),
    extraBonusContribution: num("extraBonusContribution"),
  };
}

function getRatios(inputs) {
  let userRatio;
  if (inputs.splitMode === "even") {
    userRatio = 0.5;
  } else if (inputs.splitMode === "income") {
    const total = inputs.userSalary + inputs.partnerSalary;
    userRatio = total > 0 ? inputs.userSalary / total : 0.5;
  } else {
    userRatio = inputs.customRatio / 100;
  }
  return { userRatio, partnerRatio: 1 - userRatio };
}

function utilityCost(inputs, calMonth) {
  const mult = SEASONAL_MULTIPLIER[calMonth] || 1;
  return (inputs.electricityBase + inputs.gasBase) * mult + inputs.waterBase
    + inputs.parkingCost + inputs.nhkFee;
}

function totalMonthlyJointCost(inputs, calMonth) {
  const netRent = Math.max(inputs.rent - inputs.rentSubsidy, 0);
  return netRent + utilityCost(inputs, calMonth) + inputs.foodCost + inputs.dailyNecessities;
}

function initialCostsTotal(inputs) {
  return inputs.deposit + inputs.keyMoney + inputs.guaranteeFee + inputs.fireInsurance
    + inputs.keyExchange + inputs.cleaningFee + inputs.acCleaningFee + inputs.agencyFee
    + inputs.furnitureMoveCost;
}

function runSimulation(inputs) {
  const { userRatio, partnerRatio } = getRatios(inputs);

  // 同棲期間(idx2-25, 24ヶ月)の共通生活費の平均(バッファー算定用)
  let sumJoint = 0;
  for (let i = 2; i < TIMELINE_LENGTH; i++) {
    sumJoint += totalMonthlyJointCost(inputs, TIMELINE[i].month);
  }
  const avgMonthlyJoint = sumJoint / (TIMELINE_LENGTH - 2);

  const initCosts = initialCostsTotal(inputs);
  const bufferTarget = avgMonthlyJoint * inputs.bufferTargetMonths;
  const requiredJuneTotal = initCosts + bufferTarget;

  const juneUser = requiredJuneTotal * userRatio;
  const junePartner = requiredJuneTotal * partnerRatio;

  const balance = [];
  const contribUser = [];
  const contribPartner = [];
  const personalNetUser = [];
  const personalNetPartner = [];
  let bal = 0;

  for (let i = 0; i < TIMELINE_LENGTH; i++) {
    const t = TIMELINE[i];
    let cu = 0, cp = 0; // この月の共通口座への振込額(あなた／彼女)
    let inflowUser = inputs.userSalary;
    let inflowPartner = inputs.partnerSalary;
    const isBonusMonth = BONUS_CAL_MONTHS.includes(t.month);

    if (i === 0) {
      // 2026年6月: ボーナスで初期費用＋バッファーを拠出
      cu = juneUser;
      cp = junePartner;
      inflowUser += inputs.userBonus;
      inflowPartner += inputs.partnerBonus;
      bal += cu + cp;
    } else if (i === 1) {
      // 2026年7月: 初期費用の支払い(契約・引っ越し)
      bal -= initCosts;
    } else {
      const monthlyCost = totalMonthlyJointCost(inputs, t.month);
      cu = monthlyCost * userRatio;
      cp = monthlyCost * partnerRatio;
      bal += cu + cp - monthlyCost; // 実質ゼロ(振込額=支払額)

      if (isBonusMonth) {
        inflowUser += inputs.userBonus;
        inflowPartner += inputs.partnerBonus;
        const extraU = inputs.extraBonusContribution * userRatio;
        const extraP = inputs.extraBonusContribution * partnerRatio;
        cu += extraU;
        cp += extraP;
        bal += extraU + extraP;
      }
    }

    balance.push(bal);
    contribUser.push(cu);
    contribPartner.push(cp);
    personalNetUser.push(inflowUser - cu);
    personalNetPartner.push(inflowPartner - cp);
  }

  // 個人の累積貯蓄
  const cumUser = [];
  const cumPartner = [];
  let su = 0, sp = 0;
  for (let i = 0; i < TIMELINE_LENGTH; i++) {
    su += personalNetUser[i];
    sp += personalNetPartner[i];
    cumUser.push(su);
    cumPartner.push(sp);
  }

  return {
    userRatio, partnerRatio,
    avgMonthlyJoint, initCosts, bufferTarget, requiredJuneTotal,
    juneUser, junePartner,
    balance, contribUser, contribPartner,
    cumUser, cumPartner,
    finalCumUser: cumUser[cumUser.length - 1],
    finalCumPartner: cumPartner[cumPartner.length - 1],
  };
}

let charts = {};

function renderSummary(inputs, result) {
  const cards = document.getElementById("summaryCards");
  const livingMonth0Cost = totalMonthlyJointCost(inputs, TIMELINE[2].month);
  cards.innerHTML = `
    <div class="card">
      <div class="label">初期費用合計(家具・引越し含む)</div>
      <div class="value">${yen(result.initCosts)}</div>
    </div>
    <div class="card">
      <div class="label">共通口座の最低バッファー</div>
      <div class="value">${yen(result.bufferTarget)}</div>
      <div class="sub">共通生活費平均の${document.getElementById("bufferTargetMonths").value}ヶ月分</div>
    </div>
    <div class="card">
      <div class="label">2026年6月ボーナスからの拠出額(あなた)</div>
      <div class="value">${yen(result.juneUser)}</div>
      <div class="sub">ボーナス${yen(inputs.userBonus)}のうち</div>
    </div>
    <div class="card">
      <div class="label">2026年6月ボーナスからの拠出額(彼女)</div>
      <div class="value">${yen(result.junePartner)}</div>
      <div class="sub">ボーナス${yen(inputs.partnerBonus)}のうち</div>
    </div>
    <div class="card">
      <div class="label">毎月の共通口座振込額(8月時点・あなた)</div>
      <div class="value">${yen(livingMonth0Cost * result.userRatio)}</div>
    </div>
    <div class="card">
      <div class="label">毎月の共通口座振込額(8月時点・彼女)</div>
      <div class="value">${yen(livingMonth0Cost * result.partnerRatio)}</div>
    </div>
    <div class="card">
      <div class="label">2028年7月時点の個人残余資金累積(あなた・個人費用差引前)</div>
      <div class="value">${yen(result.finalCumUser)}</div>
    </div>
    <div class="card">
      <div class="label">2028年7月時点の個人残余資金累積(彼女・個人費用差引前)</div>
      <div class="value">${yen(result.finalCumPartner)}</div>
    </div>
    <div class="card">
      <div class="label">2年間の世帯合計(個人残余資金＋共通バッファー)</div>
      <div class="value">${yen(result.finalCumUser + result.finalCumPartner + result.bufferTarget)}</div>
    </div>
  `;

  const warningBox = document.getElementById("warningBox");
  const warnings = [];
  if (result.juneUser > inputs.userBonus) {
    warnings.push(`あなたの6月の必要拠出額(${yen(result.juneUser)})がボーナス(${yen(inputs.userBonus)})を超えています。家具家電予算やバッファーを見直すか、既存の貯蓄を一部使う必要があります。`);
  }
  if (result.junePartner > inputs.partnerBonus) {
    warnings.push(`彼女の6月の必要拠出額(${yen(result.junePartner)})がボーナス(${yen(inputs.partnerBonus)})を超えています。`);
  }
  if (warnings.length > 0) {
    warningBox.style.display = "block";
    warningBox.innerHTML = warnings.join("<br>");
  } else {
    warningBox.style.display = "none";
  }

  document.getElementById("ratioResultText").textContent =
    `現在の分担方針: あなた ${(result.userRatio * 100).toFixed(1)}% / 彼女 ${(result.partnerRatio * 100).toFixed(1)}%`;
}

function renderCharts(inputs, result) {
  const labels = TIMELINE.map(t => t.label);

  const ctxBalance = document.getElementById("chartBalance");
  const ctxContribution = document.getElementById("chartContribution");
  const ctxInitial = document.getElementById("chartInitialCost");
  const ctxSavings = document.getElementById("chartSavings");

  const bufferLine = TIMELINE.map((t, i) => i >= 1 ? result.bufferTarget : null);

  if (!charts.balance) {
    charts.balance = new Chart(ctxBalance, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "共通口座残高", data: result.balance, borderColor: "#4ea1a0", backgroundColor: "rgba(78,161,160,0.15)", fill: true, tension: 0.2 },
          { label: "最低バッファー目標", data: bufferLine, borderColor: "#e88ba5", borderDash: [6, 4], pointRadius: 0, fill: false }
        ]
      },
      options: { responsive: true, plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${yen(c.raw)}` } } }, scales: { y: { ticks: { callback: (v) => yen(v) } } } }
    });
  } else {
    charts.balance.data.datasets[0].data = result.balance;
    charts.balance.data.datasets[1].data = bufferLine;
    charts.balance.update();
  }

  if (!charts.contribution) {
    charts.contribution = new Chart(ctxContribution, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "あなたの振込額", data: result.contribUser, backgroundColor: "#4ea1a0" },
          { label: "彼女の振込額", data: result.contribPartner, backgroundColor: "#e88ba5" }
        ]
      },
      options: { responsive: true, scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: (v) => yen(v) } } }, plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${yen(c.raw)}` } } } }
    });
  } else {
    charts.contribution.data.datasets[0].data = result.contribUser;
    charts.contribution.data.datasets[1].data = result.contribPartner;
    charts.contribution.update();
  }

  const initialBreakdown = {
    "敷金": inputs.deposit, "礼金": inputs.keyMoney, "初回保証料": inputs.guaranteeFee,
    "火災保険": inputs.fireInsurance, "鍵交換費": inputs.keyExchange, "ハウスクリーニング": inputs.cleaningFee,
    "エアコン清掃": inputs.acCleaningFee, "仲介手数料": inputs.agencyFee, "家具家電・引越し": inputs.furnitureMoveCost
  };
  if (!charts.initial) {
    charts.initial = new Chart(ctxInitial, {
      type: "doughnut",
      data: {
        labels: Object.keys(initialBreakdown),
        datasets: [{ data: Object.values(initialBreakdown), backgroundColor: ["#e88ba5", "#4ea1a0", "#f4b942", "#7d9bd9", "#c97fb0", "#86c4a6", "#e0815a", "#9b8fd9", "#6fb6c1"] }]
      },
      options: { responsive: true, plugins: { tooltip: { callbacks: { label: (c) => `${c.label}: ${yen(c.raw)}` } } } }
    });
  } else {
    charts.initial.data.datasets[0].data = Object.values(initialBreakdown);
    charts.initial.update();
  }

  if (!charts.savings) {
    charts.savings = new Chart(ctxSavings, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "あなたの個人残余資金(累積・個人費用差引前)", data: result.cumUser, borderColor: "#4ea1a0", backgroundColor: "rgba(78,161,160,0.2)", fill: true, stack: "s" },
          { label: "彼女の個人残余資金(累積・個人費用差引前)", data: result.cumPartner, borderColor: "#e88ba5", backgroundColor: "rgba(232,139,165,0.2)", fill: true, stack: "s" },
        ]
      },
      options: { responsive: true, plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${yen(c.raw)}` } } }, scales: { y: { stacked: true, ticks: { callback: (v) => yen(v) } } } }
    });
  } else {
    charts.savings.data.datasets[0].data = result.cumUser;
    charts.savings.data.datasets[1].data = result.cumPartner;
    charts.savings.update();
  }
}

function renderNotes(inputs, result) {
  const notes = [
    "敷金・礼金・初回保証料・火災保険・鍵交換費・ハウスクリーニング代・エアコン清掃費はご提供いただいた契約条件を基にしています。仲介手数料(家賃1ヶ月分+税)は目安です。",
    "家具・家電・引っ越し費用は「一通り新規購入」想定で35万円を初期値としています。実際の見積りが出たら数値を更新してください。",
    "光熱費(電気・ガス・水道)は40〜50㎡・2人暮らしの一般的な相場を基準値とし、夏(7-8月)・冬(12-2月)に高くなる季節変動を加味しています。インターネットは無料物件のため費用計上していません。",
    "共通口座でカバーする費目は「家賃(補助控除後)＋光熱費＋食費・日用品」です。通信費(携帯)・保険・個人の娯楽費・被服費等は対象外で、各自管理を想定しています。",
    "2026年6月のボーナス(2人分)で初期費用＋共通口座の最低バッファーを全額カバーする前提です。比率はセクション4の分担方針に従い自動計算されます。",
    "2026年12月以降のボーナスからの追加積立は初期値0円(将来の旅行・結婚資金等のために任意で増額できます)。",
    "契約期間は2年間(2026年8月〜2028年7月)で、更新料・更新時の火災保険再加入費用はこのシミュレーション期間には含めていません。2年後に契約更新する場合は別途ご検討ください。",
    "家賃補助は所得税の対象となるため、ご本人の意向で手取り月給には反映せず保守的に現状の35万円としています。実際に補助が給与に上乗せされた場合は『あなたの手取り月給』を調整してください。",
    "駐車場代・NHK受信料等は初期値0円としています。該当する場合は入力してください。",
    "緊急予備資金・結婚資金など特定の貯蓄目標額はヒアリングしておらず、本シミュレーターでは『結果として残る貯蓄額』を可視化しています。目標額があれば教えてください。",
    "グラフ・カードの「個人残余資金」は通信費・保険・娯楽費・被服費などの個人費用を差し引く前の金額です。実際の貯蓄額を知るには、ここからご自身の個人費用を引いてください。"
  ];
  const list = document.getElementById("notesList");
  list.innerHTML = notes.map(n => `<li>${n}</li>`).join("");
}

function update() {
  const inputs = readInputs();
  const result = runSimulation(inputs);
  renderSummary(inputs, result);
  renderCharts(inputs, result);
  renderNotes(inputs, result);
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("input").forEach(el => {
    el.addEventListener("input", () => {
      if (el.id === "customRatio") {
        document.getElementById("customRatioLabel").textContent = el.value + "%";
      }
      if (el.id === "bufferTargetMonths") {
        document.getElementById("bufferLabel").textContent = el.value + "ヶ月分";
      }
      update();
    });
  });
  update();
});
