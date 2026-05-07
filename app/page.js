"use client"; 
// ResearchManager v1.0 — 논문 후보 수집 · 정리 · 전달 파이프라인 (MOCK 테스트 버전)
// 실제 환경에서는 callLLM의 MOCK 블록을 제거하고 API 호출로 교체하세요.
import { useState, useEffect, useRef } from "react";

// ── MOCK callLLM ──────────────────────────────────────────────────────────────
// ── 실제 API 호출 함수 (paperSeclaude-sonnet-4-5-20250929
  const response = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      system: system,
      messages: [{ role: "user", content: userMsg }],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    })
  });
  if (!response.ok) {
    var errText = await response.text();
    throw new Error("Anthropic API error " + response.status + ": " + errText.slice(0, 500));
  }
  const data = await response.json();
  if (!data || !Array.isArray(data.content)) {
    throw new Error("Invalid Anthropic response: " + JSON.stringify(data).slice(0, 500));
  }
  return data.content
    .filter(function(b) { return b.type === "text" || b.type === "tool_result"; })
    .map(function(b) {
      if (b.type === "text") return b.text;
      if (b.type === "tool_result" && Array.isArray(b.content)) {
        return b.content.filter(function(c){ return c.type === "text"; }).map(function(c){ return c.text; }).join("");
      }
      return "";
    })
    .join("");
}

const _delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function callLLM(system, userMsg) {
  await _delay(500 + Math.random() * 600);

  // 원문 전체 추출 (자르지 않음)
  var origQ = (userMsg.match(/병목 가설:[ ]*([^\n]+)/) || ["",""])[1].trim() ||
              (userMsg.match(/사용자 원문:[ ]*([^\n]+)/) || ["",""])[1].trim() ||
              "리서치 주제";

  // 질문 유형 분류 — 키워드 기반
  var isED       = /응급실|ED|emergency|체류 시간|length of stay|boarding|퇴원 결정/.test(origQ);
  var isSurgical = /수술|surgical|postoperative|재입원|readmission/.test(origQ);
  var isOutpatient = /외래|초진|예약|대기|outpatient|appointment/.test(origQ);

  if (system.includes("PICO") || system.includes("target_context") || system.includes("search_queries") && system.includes("concept_groups")) {
    var hypo, anchors, preserves, ctx, concepts, queries;

    if (isED) {
      hypo     = "응급실 내 퇴원 결정 지연이 환자 체류 시간 연장의 핵심 운영 병목으로 작용한다";
      anchors  = ["emergency department length of stay","ED boarding","discharge decision delay","patient flow","bed management","workflow bottleneck"];
      preserves= ["응급실","체류 시간","퇴원 결정 지연"];
      ctx      = { population:"응급실 내 퇴원 대기 또는 입원 결정 지연 환자", setting:"응급실 · 병상 배정 · 협진 및 검사 완료 단계", outcome:"ED 체류 시간 · 퇴원 결정 지연 시간 · 환자 흐름 병목" };
      concepts = { problem_terms:["ED boarding","discharge delay","overcrowding"], operation_terms:["bed management","patient flow","care coordination"], data_terms:["EHR","real-time bed tracking","LOS data"], business_terms:["throughput","capacity utilization","ED efficiency"] };
      queries  = ["emergency department length of stay discharge decision delay operations","ED boarding patient flow bed management hospital workflow","emergency department crowding discharge process bottleneck systematic review","ED length of stay reduction intervention hospital operations case study"];
    } else if (isSurgical) {
      hypo     = "수술 후 30일 재입원률 상승의 원인이 되는 병원 내 운영 프로세스 병목이 존재한다";
      anchors  = ["postoperative","surgical","30-day readmission","hospital operations","workflow"];
      preserves= ["수술 후","30일 재입원률","병원 내 운영 프로세스"];
      ctx      = { population:"수술 후 입원 환자", setting:"급성기 병원 수술 병동 · 퇴원 전환 단계", outcome:"30일 재입원률 · 수술 후 합병증 관련 재입원" };
      concepts = { problem_terms:["readmission","surgical complication","care transition"], operation_terms:["workflow","discharge coordination","patient tracking"], data_terms:["EHR","claims data","risk prediction"], business_terms:["hospital efficiency","resource utilization","cost"] };
      queries  = ["postoperative readmission hospital workflow process failure","surgical care transition 30-day readmission operations","postoperative discharge coordination EHR readmission prevention","surgical readmission reduction intervention systematic review hospital"];
    } else if (isOutpatient) {
      hypo     = "외래 초진 예약 대기 시간 연장이 환자 접근성과 병원 운영 효율성에 영향을 미치는 병목이다";
      anchors  = ["outpatient appointment","wait time","access","scheduling","patient flow"];
      preserves= ["외래","초진","예약 대기 시간"];
      ctx      = { population:"외래 초진 예약 환자", setting:"병원 외래 클리닉 · 예약 시스템 · 접수 단계", outcome:"초진 대기 시간 · 예약 완료율 · 환자 만족도" };
      concepts = { problem_terms:["wait time","access delay","scheduling bottleneck"], operation_terms:["appointment scheduling","patient flow","clinic operations"], data_terms:["EHR","appointment data","no-show rates"], business_terms:["capacity","throughput","patient satisfaction"] };
      queries  = ["outpatient appointment wait time reduction hospital operations","first visit scheduling bottleneck patient access workflow","clinic appointment delay operations management intervention systematic review","outpatient access time scheduling efficiency hospital case study"];
    } else {
      hypo     = origQ + " — 관련 운영 프로세스 병목이 환자 결과에 영향을 미친다";
      anchors  = ["hospital operations","workflow","patient flow","process bottleneck"];
      preserves= [];
      ctx      = { population:"입원 또는 외래 환자", setting:"병원 운영 프로세스 전반", outcome:"운영 효율성 · 환자 결과 지표" };
      concepts = { problem_terms:["bottleneck","process failure","workflow delay"], operation_terms:["workflow","coordination","operations"], data_terms:["EHR","operational data"], business_terms:["efficiency","cost","throughput"] };
      queries  = ["hospital operations workflow bottleneck patient outcomes","process improvement hospital efficiency systematic review","hospital workflow optimization intervention evidence","hospital operations management patient flow case study"];
    }

    return JSON.stringify({
      user_original_question: origQ,
      bottleneck_hypothesis: hypo,
      domain_anchor_terms: anchors,
      must_preserve_terms: preserves,
      target_context: ctx,
      concept_groups: concepts,
      search_queries: queries,
    });
  }

  if (system.includes("inclusion_criteria") && system.includes("source_preference")) {
    var sqBase = isED ? [
      {query:"emergency department length of stay discharge decision delay operations",purpose:"응급실 체류 시간과 퇴원 결정 지연 논문 탐색",source_preference:"paper",covered_terms:["ED boarding","discharge decision delay"],query_axis:"problem"},
      {query:"ED boarding patient flow bed management hospital workflow",purpose:"병상 관리 및 환자 흐름 개선 근거 탐색",source_preference:"paper",covered_terms:["ED boarding","bed management","patient flow"],query_axis:"operation"},
      {query:"emergency department crowding discharge process bottleneck systematic review",purpose:"체계적 고찰 탐색",source_preference:"paper",covered_terms:["ED boarding","workflow bottleneck"],query_axis:"review"},
      {query:"ED length of stay reduction intervention hospital operations guideline",purpose:"가이드라인 탐색",source_preference:"guideline",covered_terms:["ED length of stay","hospital operations"],query_axis:"intervention"},
      {query:"emergency department discharge delay case study hospital operations",purpose:"운영 사례 탐색",source_preference:"case",covered_terms:["discharge delay","hospital operations"],query_axis:"operation"},
    ] : isSurgical ? [
      {query:"postoperative readmission hospital workflow process failure",purpose:"수술 후 재입원과 운영 프로세스 연결 탐색",source_preference:"paper",covered_terms:["postoperative","30-day readmission"],query_axis:"problem"},
      {query:"surgical care transition 30-day readmission operations",purpose:"수술 환자 퇴원 전환 사례 탐색",source_preference:"paper",covered_terms:["surgical","care transition"],query_axis:"operation"},
      {query:"postoperative discharge coordination EHR readmission prevention",purpose:"EHR 기반 퇴원 조정 탐색",source_preference:"paper",covered_terms:["postoperative","EHR"],query_axis:"data_method"},
      {query:"surgical readmission reduction guideline hospital operations",purpose:"가이드라인 탐색",source_preference:"guideline",covered_terms:["surgical","30-day readmission"],query_axis:"intervention"},
      {query:"postoperative care coordination case study hospital",purpose:"운영 사례 탐색",source_preference:"case",covered_terms:["postoperative","hospital operations"],query_axis:"operation"},
    ] : [
      {query:"hospital workflow bottleneck patient outcomes operations",purpose:"운영 병목 일반 탐색",source_preference:"paper",covered_terms:["workflow","bottleneck"],query_axis:"problem"},
      {query:"hospital process improvement efficiency systematic review",purpose:"체계적 고찰 탐색",source_preference:"paper",covered_terms:["hospital operations","efficiency"],query_axis:"review"},
      {query:"hospital operations management intervention patient flow",purpose:"개입 근거 탐색",source_preference:"paper",covered_terms:["patient flow","operations"],query_axis:"intervention"},
      {query:"hospital workflow optimization guideline",purpose:"가이드라인 탐색",source_preference:"guideline",covered_terms:["workflow","optimization"],query_axis:"operation"},
    ];
    return JSON.stringify({
      search_queries: sqBase,
      inclusion_criteria:["2015년 이후 peer-reviewed 출판","병원 운영 또는 환자 흐름 직접 관련","초록 또는 DOI 확인 가능","데이터 기반 결과 지표 포함"],
      exclusion_criteria:["순수 임상 치료 효과 연구","병원 운영 병목 연결 약한 논문","초록 및 DOI 모두 없는 학술대회 발표"],
    });
  }

  if (system.includes("candidate_papers") || system.includes("web_search")) {
    const prefix = userMsg.includes("A") ? "A" : userMsg.includes("B") ? "B" : userMsg.includes("C") ? "C" : "D";
    const pMap = {
      A: [
        {title:"Transitional Care Interventions and Hospital Readmissions",url:"https://annals.org/aim/article/transitional-care-readmission-rct",year:"2023",journal:"Annals of Internal Medicine",source_type:"paper",snippet:"Systematic review of 26 RCTs examining transitional care interventions for older adults with chronic conditions",doi:"10.7326/M23-0001"},
        {title:"EHR-based Discharge Risk Prediction Model",url:"https://jamia.oxfordjournals.org/content/ehr-discharge-risk-prediction",year:"2022",journal:"JAMIA",source_type:"paper",snippet:"Machine learning model predicting 30-day readmission using EHR data from 12 hospitals",doi:"10.1093/jamia/ocab001"},
        {title:"Nurse-led Discharge Coordination Outcomes",url:"https://bmjopen.bmj.com/content/nurse-led-discharge-coordination",year:"2024",journal:"BMJ Open",source_type:"paper",snippet:"Prospective cohort study: nurse coordinator program reduced readmission by 23%",doi:"10.1136/bmjopen-2024-001"},
        {title:"Care Transitions Clinical Practice Guideline",url:"https://www.jointcommission.org/resources/care-transitions-guideline",year:"2021",journal:null,source_type:"guideline",snippet:"Joint Commission guidelines for effective care transition programs in acute care",doi:null},
        {title:"Workflow Automation in Discharge Planning",url:"https://healthaffairs.org/doi/workflow-automation-discharge",year:"2022",journal:"Health Affairs",source_type:"case_study",snippet:"Case study: automated discharge workflow system reducing length of stay by 1.4 days",doi:"10.1377/hlthaff.2022.001"},
      ],
      B: [
        {title:"Readmission Reduction Through Telehealth Follow-up",url:"https://pubmed.ncbi.nlm.nih.gov/telehealth-followup-readmission",year:"2023",journal:"JAMA Internal Medicine",source_type:"paper",snippet:"RCT showing telehealth-based follow-up reduced 30-day readmission by 18% in heart failure patients",doi:"10.1001/jamainternmed.2023.001"},
        {title:"Systematic Review: Post-discharge Care Coordination",url:"https://www.cochranelibrary.com/post-discharge-care-coordination",year:"2022",journal:"Cochrane Database",source_type:"paper",snippet:"Meta-analysis of 34 trials on post-discharge coordination interventions and readmission outcomes",doi:"10.1002/14651858.CD001"},
        {title:"Patient Navigator Program and Hospital Outcomes",url:"https://www.nejm.org/doi/patient-navigator-hospital-outcomes",year:"2023",journal:"NEJM",source_type:"paper",snippet:"Large cohort study demonstrating patient navigator programs reduce 90-day readmission",doi:"10.1056/NEJMoa2023001"},
        {title:"Hospital at Home: Operational Evidence Review",url:"https://jamanetwork.com/journals/hospital-at-home-operations",year:"2024",journal:"JAMA Network Open",source_type:"paper",snippet:"Evidence synthesis on hospital-at-home model for reducing acute care utilization",doi:"10.1001/jamanetworkopen.2024.001"},
        {title:"CMS Transitional Care Management Guideline 2023",url:"https://www.cms.gov/medicare/transitional-care-management-2023",year:"2023",journal:null,source_type:"guideline",snippet:"CMS updated guidelines on transitional care management billing and quality requirements",doi:null},
      ],
      C: [
        {title:"Discharge Planning Intervention and 30-Day Readmission",url:"https://www.sciencedirect.com/science/discharge-planning-readmission",year:"2022",journal:"The Lancet",source_type:"paper",snippet:"Cluster RCT of structured discharge planning reducing 30-day readmission in elderly patients",doi:"10.1016/S0140-6736(22)00001"},
        {title:"Predictive Analytics for Hospital Readmission",url:"https://academic.oup.com/jamia/predictive-analytics-readmission",year:"2023",journal:"JAMIA",source_type:"paper",snippet:"Development and validation of ML model predicting 30-day readmission with 0.82 AUROC",doi:"10.1093/jamia/ocad001"},
        {title:"Multidisciplinary Discharge Team and Outcomes",url:"https://www.bmj.com/content/multidisciplinary-discharge-team",year:"2021",journal:"BMJ",source_type:"paper",snippet:"Before-after study of multidisciplinary discharge team reducing LOS and readmission",doi:"10.1136/bmj.n001"},
        {title:"Electronic Care Transitions Summary Effectiveness",url:"https://www.ncbi.nlm.nih.gov/pmc/electronic-care-transitions",year:"2022",journal:"Journal of General Internal Medicine",source_type:"paper",snippet:"Assessment of electronic care transition summaries on follow-up adherence in chronic disease patients",doi:"10.1007/s11606-022-001"},
        {title:"Patient Education at Discharge: Systematic Review",url:"https://www.cochranelibrary.com/patient-education-discharge-sr",year:"2023",journal:"Cochrane Database",source_type:"paper",snippet:"Systematic review of patient education interventions at discharge on readmission and self-management",doi:"10.1002/14651858.CD002"},
      ],
      D: [
        {title:"Real-world Impact of Discharge Pharmacist Programs",url:"https://www.pharmacotherapy.org/discharge-pharmacist-impact",year:"2023",journal:"Pharmacotherapy",source_type:"paper",snippet:"Retrospective cohort study on discharge pharmacist program reducing medication-related readmissions",doi:"10.1002/phar.2023.001"},
        {title:"Social Determinants of Health and Readmission",url:"https://www.healthaffairs.org/doi/sdoh-readmission-analysis",year:"2022",journal:"Health Affairs",source_type:"paper",snippet:"Large claims analysis linking social determinants of health to 30-day readmission risk",doi:"10.1377/hlthaff.2022.002"},
        {title:"Hospital Discharge Planning Quality Indicators",url:"https://qualitymeasures.ahrq.gov/discharge-planning-quality",year:"2021",journal:null,source_type:"guideline",snippet:"AHRQ quality indicators for discharge planning process effectiveness in acute care",doi:null},
        {title:"Case Study: Mayo Clinic Discharge Optimization",url:"https://www.mayoclinicproceedings.org/discharge-optimization-case",year:"2023",journal:"Mayo Clinic Proceedings",source_type:"case_study",snippet:"Implementation case study of discharge optimization program at Mayo Clinic reducing readmission",doi:"10.1016/j.mayocp.2023.001"},
        {title:"Geriatric Care Transitions: Evidence and Practice",url:"https://www.jamanetwork.com/geriatric-care-transitions-review",year:"2024",journal:"JAMA",source_type:"paper",snippet:"Comprehensive review of evidence-based geriatric care transition models and implementation strategies",doi:"10.1001/jama.2024.001"},
      ],
    };

    // 검색어 기반 주제 분류
    var origForSearch = (userMsg.match(/검색어:[ ]*([^\n(]+)/) || ["",""])[1].trim();
    var isEDSearch       = /emergency department|ED boarding|length of stay|discharge decision|bed management|patient flow/.test(origForSearch);
    var isSurgicalSearch = /postoperative|surgical|30-day readmission|care transition/.test(origForSearch);

    var surgicalPapers = [
      {title:"Postoperative 30-Day Readmission Risk Factors: A Systematic Review",url:"https://www.annalsurgery.org/postoperative-readmission-systematic-review",year:"2023",journal:"Annals of Surgery",source_type:"paper",snippet:"Systematic review of 38 studies identifying postoperative care transition failures, medication reconciliation gaps, and follow-up non-adherence as primary drivers of 30-day readmission",doi:"10.1097/SLA.readmission001"},
      {title:"Surgical Discharge Planning and Unplanned Readmission",url:"https://jamanetwork.com/journals/jamasurgery/surgical-discharge-readmission",year:"2022",journal:"JAMA Surgery",source_type:"paper",snippet:"Retrospective cohort of 12,000 surgical patients: structured discharge checklist reduced 30-day readmission by 19% through improved care coordination",doi:"10.1001/jamasurg.2022.001"},
      {title:"Enhanced Recovery After Surgery and Hospital Readmission",url:"https://www.sciencedirect.com/science/eras-readmission-outcomes",year:"2024",journal:"The Lancet",source_type:"paper",snippet:"RCT comparing ERAS protocol vs standard care: ERAS group showed 24% lower readmission rate and shorter LOS across 8 surgical specialties",doi:"10.1016/S0140-6736(24)00001"},
      {title:"Postoperative Care Transitions and Follow-up Adherence",url:"https://academic.oup.com/bjsopen/postoperative-care-transitions",year:"2023",journal:"BJS Open",source_type:"paper",snippet:"Prospective cohort: 43% of 30-day readmissions linked to missed follow-up appointments or inadequate discharge instructions in surgical patients",doi:"10.1093/bjsopen/readmission001"},
      {title:"Surgical Ward Workflow and Discharge Delay: Operational Analysis",url:"https://www.healthaffairs.org/doi/surgical-ward-discharge-workflow",year:"2022",journal:"Health Affairs",source_type:"case_study",snippet:"Case study at 3 teaching hospitals: discharge decision delay in surgical wards averaged 4.2 hours due to consultant availability and documentation bottlenecks",doi:"10.1377/hlthaff.2022.surgical"},
    ];

    var edPapers = [
      {title:"Emergency Department Length of Stay and Discharge Decision Delays",url:"https://academic.oup.com/jamia/ed-los-discharge-delay",year:"2023",journal:"JAMIA",source_type:"paper",snippet:"Retrospective study analyzing EHR data from 8 hospitals identifying discharge decision delay as primary driver of ED LOS",doi:"10.1093/jamia/ed001"},
      {title:"ED Boarding and Patient Flow: A Systematic Review",url:"https://www.annemergmed.com/ed-boarding-systematic-review",year:"2022",journal:"Annals of Emergency Medicine",source_type:"paper",snippet:"Systematic review of 42 studies on ED boarding causes including bed management, consultation delays, and discharge processes",doi:"10.1016/j.annemergmed.2022.001"},
      {title:"Reducing ED Crowding Through Discharge Process Redesign",url:"https://www.bmjopen.bmj.com/ed-crowding-discharge-redesign",year:"2024",journal:"BMJ Open",source_type:"paper",snippet:"Quasi-experimental study: structured discharge checklist reduced ED LOS by 47 minutes on average",doi:"10.1136/bmjopen-2024-002"},
      {title:"Bed Management Operations and ED Throughput",url:"https://qualitymeasures.ahrq.gov/bed-management-ed-throughput",year:"2022",journal:null,source_type:"guideline",snippet:"AHRQ guideline on real-time bed management systems and their impact on ED patient throughput and boarding rates",doi:null},
      {title:"ED Discharge Decision Time: Operational Bottleneck Analysis",url:"https://www.healthaffairs.org/ed-discharge-decision-bottleneck",year:"2023",journal:"Health Affairs",source_type:"case_study",snippet:"Case study: AI-assisted discharge prediction tool reduced discharge decision time by 32% at urban teaching hospital",doi:"10.1377/hlthaff.2023.003"},
    ];

    if (isEDSearch) {
      return JSON.stringify({ sources: edPapers.map((s, i) => Object.assign({}, s, { id: prefix + (i+1) })) });
    }
    if (isSurgicalSearch) {
      return JSON.stringify({ sources: surgicalPapers.map((s, i) => Object.assign({}, s, { id: prefix + (i+1) })) });
    }

    const items = pMap[prefix] || pMap.A;
    return JSON.stringify({ sources: items.map((s, i) => Object.assign({}, s, { id: prefix + (i+1) })) });
  }

  if (system.includes("normalized_candidates") || system.includes("study_type")) {
    let papers = [];
    try {
      const arrMatch = userMsg.match(/\[\s*\{[\s\S]+?\}\s*\]/);
      papers = arrMatch ? JSON.parse(arrMatch[0]).slice(0,20) : [];
    } catch(e) { papers = []; }
    if (!papers.length) {
      return JSON.stringify({normalized_candidates:[],missing_fields_summary:{missing_abstract:0,missing_doi:0,missing_year:0,missing_journal:0}});
    }
    return JSON.stringify({
      normalized_candidates: papers.map(function(p,i) {
        var t = (p.title||"").toLowerCase();
        var s = (p.snippet||"").toLowerCase();
        var combined = t + " " + s;

        // study_type: 제목/요약 키워드 기반 추론
        var study_type = "unknown";
        if (/systematic review|meta-analysis|meta analysis/.test(combined)) study_type = "systematic_review";
        else if (/guideline|practice guide|recommendations/.test(combined)) study_type = "guideline";
        else if (/randomized|rct|randomised/.test(combined)) study_type = "RCT";
        else if (/cohort|prospective|longitudinal/.test(combined)) study_type = "cohort";
        else if (/retrospective|claims|administrative data/.test(combined)) study_type = "cohort";
        else if (/quasi-experimental|before-after|pre-post|quasi experimental/.test(combined)) study_type = "quasi_experimental";
        else if (/case study|implementation|case report/.test(combined)) study_type = "case_study";
        else if (p.source_type === "guideline") study_type = "guideline";
        else if (p.source_type === "case_study") study_type = "case_study";
        else if (p.source_type === "paper") study_type = "cohort";

        // data_type: 키워드 기반 추론
        var data_type = "unknown";
        if (/ehr|electronic health record|electronic medical record|emr/.test(combined)) data_type = "EHR";
        else if (/claims|administrative data|insurance/.test(combined)) data_type = "claims";
        else if (/survey|questionnaire/.test(combined)) data_type = "survey";
        else if (/mixed|multiple data/.test(combined)) data_type = "mixed";
        else if (p.source_type === "paper") data_type = "mixed";

        // abstract: snippet만 사용, 불필요한 추가 문장 없음
        var abstract = p.abstract || p.snippet || null;

        // domain_anchor_terms: userMsg에서 추출 (현재 질문의 검색 초점)
        var anchorLine = (userMsg.match(/domain_anchor_terms[^\[]*(\[[^\]]+\])/) || ["",""])[1];
        var anchors = [];
        try { anchors = anchorLine ? JSON.parse(anchorLine) : []; } catch(e) { anchors = []; }
        var anchorStr = anchors.join(" ").toLowerCase();

        // 현재 질문 유형 판별 (anchor 기반 우선, combined 보조)
        var isEDContext       = /emergency department|ed boarding|length of stay|discharge decision|bed management/.test(anchorStr) ||
                                /emergency department|ed |ed boarding|length of stay|los |discharge decision/.test(combined);
        var isSurgicalContext = /postoperative|surgical|30-day readmission/.test(anchorStr) ||
                                /postoperative|surgical|30-day readmission/.test(combined);
        var isFlowContext     = /patient flow|bed management|throughput|capacity/.test(anchorStr) ||
                                /bed management|patient flow|throughput|capacity/.test(combined);

        // relevance_note: 현재 질문 맥락 기준으로 생성
        var rel = "";
        if (isSurgicalContext) {
          if (/systematic review|meta-analysis/.test(combined)) {
            rel = "수술 후 재입원 관련 체계적 고찰 — 운영 병목 원인 구조화 및 근거 강도 확인에 핵심 자료";
          } else if (/eras|enhanced recovery/.test(combined)) {
            rel = "ERAS 프로토콜과 재입원 연결 — 수술 후 운영 프로세스 개선 직접 근거";
          } else if (/discharge|care transition|follow-up/.test(combined)) {
            rel = "수술 후 퇴원 계획·추적관리·care transition 병목 — 30일 재입원 운영 원인 분석에 직접 활용";
          } else if (/workflow|ward|bottleneck|delay/.test(combined)) {
            rel = "수술 병동 워크플로우 및 퇴원 지연 분석 — 운영 병목 위치 파악 및 개선 설계에 유용";
          } else if (/guideline|practice guide/.test(combined)) {
            rel = "수술 후 관리 가이드라인 — 보조 근거로 활용, 직접 선정 우선순위는 낮음";
          } else if (/case study|implementation/.test(combined)) {
            rel = "수술 환자 퇴원 최적화 사례 — 운영 개선 아이디어 번역 및 실행 가능성 평가에 유용";
          } else {
            rel = "수술 후 재입원 또는 퇴원 전환 관련 — 운영 프로세스 병목 근거로 활용 가능";
          }
        } else if (isEDContext) {
          if (/systematic review|meta-analysis/.test(combined)) {
            rel = "ED 체류 시간·boarding 관련 체계적 고찰 — 응급실 운영 병목 원인 구조화에 핵심 자료";
          } else if (/discharge decision|discharge process/.test(combined)) {
            rel = "ED 내 퇴원 결정 지연 직접 분석 — 응급실 운영 병목의 핵심 원인 탐색에 최우선 후보";
          } else if (/bed management|throughput/.test(combined)) {
            rel = "병상 관리·환자 흐름 관련 — ED 체류 시간 연장의 운영 병목 위치 파악에 유용";
          } else if (/guideline/.test(combined)) {
            rel = "응급실 운영 개선 가이드라인 — 보조 근거로 활용, 직접 선정 우선순위는 낮음";
          } else {
            rel = "ED 체류 시간 또는 퇴원 결정 지연 관련 — 응급실 운영 병목 분석에 직접 활용 가능";
          }
        } else if (isFlowContext) {
          rel = "병상 관리·환자 흐름 관련 — 운영 병목 위치 파악 및 개입 설계에 유용";
        } else if (/guideline|practice guide/.test(combined)) {
          rel = "운영 개선 가이드라인 — 보조 근거로 활용, 직접 선정 우선순위는 낮음";
        } else if (/systematic review|meta-analysis/.test(combined)) {
          rel = "체계적 고찰 — 다수 연구를 종합해 배경 구조화 및 근거 강도 확인에 유용";
        } else if (/case study|implementation/.test(combined)) {
          rel = "실제 병원 구현 사례 — 운영 개선 아이디어 번역 및 실행 가능성 평가에 유용";
        } else {
          rel = "병원 운영 개선 관련 — 병목 가설과의 직접 연결성 추가 확인 필요";
        }

        return {
          id:p.id||("P"+(i+1)), title:p.title, url:p.url, doi:p.doi||null,
          year:p.year||"unknown", journal:p.journal||null,
          abstract: abstract,
          source_type:p.source_type||"other",
          study_type: study_type,
          data_type: data_type,
          relevance_note: rel,
        };
      }),
      missing_fields_summary:{ missing_abstract:2, missing_doi:3, missing_year:1, missing_journal:4 },
    });
  }

  if (system.includes("filtered_candidates") || system.includes("screening_tags")) {
    let papers = [];
    try {
      const arrMatch = userMsg.match(/\[\s*\{[\s\S]+?\}\s*\]/);
      papers = arrMatch ? JSON.parse(arrMatch[0]).slice(0,20) : [];
    } catch(e) { papers = []; }
    if (!papers.length) {
      return JSON.stringify({filtered_candidates:[],excluded:[]});
    }
    const filtered = papers.slice(0, Math.max(5, Math.floor(papers.length * 0.8)));
    const excluded = papers.slice(Math.max(5, Math.floor(papers.length * 0.8)));
    return JSON.stringify({
      filtered_candidates: filtered.map((p,i) => ({
        ...p,
        screening_tags: [
          ...(p.abstract ? ["has_abstract"] : []),
          ...(p.year && parseInt(p.year) >= 2020 ? ["recent_5yr"] : []),
          ...(i%2===0 ? ["hospital_ops_relevant"] : []),
          ...(p.study_type && p.study_type !== "unknown" ? ["data_method_clear"] : []),
        ],
      })),
      excluded: excluded.map(p => ({ id:p.id, reason:"초록 부족 또는 병원 운영 연결 불명확" })),
    });
  }

  if (system.includes("selection_analyst_prompt") || system.includes("handoff_to")) {
    const _m=userMsg.match(/\[[\s\S]+?\]/); const papers = JSON.parse(_m ? _m[0] : "[]").slice(0,8);
    return JSON.stringify({
      handoff_to:"Paper Selection Analyst",
      bottleneck_hypothesis:q+"에서 운영 프로세스 병목이 30일 재입원률에 영향을 미친다",
      selection_goal:"NotebookLM 및 Paper Analysis Agent에 투입할 핵심 논문 1~3편 선정",
      candidate_count: papers.length,
      candidate_papers: papers.map(p => ({id:p.id,title:p.title,year:p.year,journal:p.journal,doi:p.doi,study_type:p.study_type,data_type:p.data_type,screening_tags:p.screening_tags||[]})),
      suggested_evaluation_rubric:{
        bottleneck_fit:"이 논문이 퇴원 후 추적관리 누락과 재입원 증가 간의 운영 병목을 직접 다루는가",
        data_method_fit:"EHR·청구 데이터·환자 추적 방법론이 병원 운영 분석에 적용 가능한가",
        business_insight_potential:"병원 워크플로우 개선·비용 절감·환자 흐름 최적화 인사이트로 번역 가능한가",
        evidence_strength:"연구 설계(RCT·코호트·체계적 고찰)와 저널 신뢰도가 충분한가",
      },
      known_limitations:[
        "web_search 기반 수집으로 DOI 및 전문 확인 불가 — 실제 원문 접근 필요",
        "국내 병원 환경 특수성 미반영 — 해외 연구 중심 수집",
        "최신 2024~2025년 출판물 일부 누락 가능성",
      ],
      notes_for_selection_analyst:[
        "퇴원 전환 개입(transitional care intervention) 관련 체계적 고찰 우선 검토 권장",
        "EHR 기반 예측 모델 논문은 데이터 구조 참고용으로 활용 가능",
        "가이드라인 논문은 보조 근거로만 활용 — 선정 우선순위 낮음",
      ],
      selection_analyst_prompt:"(buildSelectionAnalystPrompt로 덮어씀)",
    });
  }

  return "{}";
}

// ── constants ─────────────────────────────────────────────────────────────────
const TYPE_LABEL = { paper:"논문/학술", guideline:"가이드라인", case_study:"사례연구", news:"뉴스", other:"기타" };

const STAGE_UI = [
  { id:"structuring",     label:"병목 가설 구조화", emoji:"🧩", color:"#4FC3F7", desc:"사용자 가설 → population · setting · outcome · 검색 쿼리로 분해" },
  { id:"search_strategy", label:"검색 전략 생성",   emoji:"🎯", color:"#7986CB", desc:"쿼리 4개 이상 + 포함/제외 기준 생성" },
  { id:"search",          label:"후보 논문 수집",   emoji:"🔍", color:"#FFB74D", desc:"4쿼리 병렬 · dedupe 후 목표 10편" },
  { id:"verify",          label:"후보 실재성 검증", emoji:"🛡️", color:"#4DB6AC", desc:"DOI · URL · 제목 형식 검증 및 placeholder 후보 제거" },
  { id:"metadata_extract", label:"출처 메타데이터 보강", emoji:"🧾", color:"#26A69A", desc:"URL · DOI · PMID · PMCID 기반 출처/식별자/선별 준비도 1차 보강" },
  { id:"normalize",       label:"메타데이터 정리",  emoji:"📄", color:"#CE93D8", desc:"DOI · 초록 · 연도 · 연구유형 보강 및 스키마 통일" },
  { id:"filter",          label:"기본 품질 필터",   emoji:"⚖️", color:"#EF9F27", desc:"중복 제거 · screening tags · 최종 선정 금지" },
  { id:"handoff",         label:"전달 패키지 생성", emoji:"📦", color:"#80DEEA", desc:"후보군 패키지 + Selection Analyst 프롬프트 생성" },
];

const STATUS_MAP = {
  idle:                 { label:"NOT STARTED",  color:"#546E7A" },
  structuring:          { label:"STRUCTURING",  color:"#4FC3F7" },
  search_strategy:      { label:"STRATEGIZING", color:"#7986CB" },
  search:               { label:"SEARCHING",    color:"#FFB74D" },
  verify:               { label:"VERIFYING",    color:"#4DB6AC" },
  metadata_extract:     { label:"EXTRACTING",   color:"#26A69A" },
  normalize:            { label:"NORMALIZING",  color:"#CE93D8" },
  filter:               { label:"FILTERING",    color:"#EF9F27" },
  handoff:              { label:"PACKAGING",    color:"#80DEEA" },
  done:                 { label:"DONE ✓",       color:"#66BB6A" },
  error:                { label:"ERROR",        color:"#EF5350" },
  insufficient_evidence:{ label:"근거 부족 ⚠",  color:"#FFB74D" },
};

const EXAMPLES = [
  "응급실 체류 시간이 긴 환자군에서 퇴원 결정 지연의 주요 운영 병목 요인은?",
  "수술 후 30일 재입원률을 높이는 병원 내 운영 프로세스 상의 병목은?",
  "외래 초진 예약 대기 시간을 단축시킨 병원 운영 개입 전략의 실증 효과는?",
];

// ── utils ─────────────────────────────────────────────────────────────────────
function safeParseJSON(raw) {
  if (!raw) return null;
  let clean = raw.replace(/```json\s*/gi,"").replace(/```\s*/g,"").trim();
  const start=clean.indexOf("{"), end=clean.lastIndexOf("}");
  if (start===-1||end===-1) return null;
  const c=clean.slice(start,end+1);
  try{return JSON.parse(c);}catch(e1){try{return JSON.parse(c.replace(/,\s*([}\]])/g,"$1"));}catch(e2){return null;}}
}
const CRED_RANK={high:3,medium:2,low:1};
const TYPE_PRIORITY={paper:5,guideline:4,case_study:3,news:2,other:0};
function dedupSources(sources){
  const seen=new Map();
  for(const s of sources){
    const key=(s.url||"").trim().replace(/\/+$/,"").toLowerCase();
    if(!key||key==="https:") continue;
    if(!seen.has(key))seen.set(key,s);
    else if((CRED_RANK[s.credibility]||0)>(CRED_RANK[seen.get(key).credibility]||0))seen.set(key,s);
  }
  return Array.from(seen.values());
}

// ── verification helpers (v1.1 형식 기반 검증 only) ─────────────────────────
function isValidDoiFormat(doi) {
  if (!doi || typeof doi !== "string") return false;
  return /^10[.][0-9]{4,9}[/][-._;()/:A-Z0-9]+$/i.test(doi.trim());
}

// ── source metadata extractor helpers ────────────────────────────────────────
function cleanDoi(raw) {
  if (!raw) return null;
  var s = raw.trim();
  try { s = decodeURIComponent(s); } catch(e) {}
  s = s.replace(/[.,;:)\]'"]+$/, "");
  return s || null;
}
function extractDoiFromText(text) {
  if (!text) return null;
  var m = text.match(/10[.][0-9]{4,9}[/][-._;()/:A-Z0-9]+/i);
  return m ? cleanDoi(m[0]) : null;
}
function extractDoiFromUrl(url) {
  if (!url) return null;
  var m = url.match(/(?:doi\.org\/|\/doi\/(?:full\/|abs\/)?)(10[.][0-9]{4,9}[/][-._;()/:A-Z0-9]+)/i);
  if (m) return cleanDoi(m[1]);
  return extractDoiFromText(url);
}
function extractPubMedIdFromUrl(url) {
  if (!url) return null;
  var m = url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/([0-9]+)/);
  return m ? m[1] : null;
}
function extractPmcIdFromUrl(url) {
  if (!url) return null;
  var m = url.match(/pmc\.ncbi\.nlm\.nih\.gov\/articles\/(PMC[0-9]+)/i);
  return m ? m[1] : null;
}
function inferSourceFromUrl(url, existingSourceType) {
  if (!url) return { source_type: existingSourceType||"other", source_name: "unknown", source_family: "unknown" };
  var h = "";
  try { h = new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch(e) { return { source_type: existingSourceType||"other", source_name: url, source_family: "unknown" }; }
  var map = [
    [/pubmed\.ncbi\.nlm\.nih\.gov/,       { source_type:"paper",    source_name:"PubMed",                          source_family:"pubmed" }],
    [/pmc\.ncbi\.nlm\.nih\.gov/,          { source_type:"paper",    source_name:"PubMed Central",                  source_family:"pmc" }],
    [/ncbi\.nlm\.nih\.gov/,               { source_type:"paper",    source_name:"NCBI",                            source_family:"ncbi" }],
    [/jamanetwork\.com/,                  { source_type:"paper",    source_name:"JAMA Network",                    source_family:"jama" }],
    [/nejm\.org/,                         { source_type:"paper",    source_name:"New England Journal of Medicine",  source_family:"nejm" }],
    [/sciencedirect\.com/,                { source_type:"paper",    source_name:"ScienceDirect",                   source_family:"sciencedirect" }],
    [/link\.springer\.com|springer\.com/, { source_type:"paper",    source_name:"Springer",                        source_family:"springer" }],
    [/academic\.oup\.com/,                { source_type:"paper",    source_name:"Oxford Academic",                 source_family:"oup" }],
    [/bmj\.com|bmjopen\.bmj\.com/,        { source_type:"paper",    source_name:"BMJ",                             source_family:"bmj" }],
    [/thelancet\.com/,                    { source_type:"paper",    source_name:"The Lancet",                      source_family:"lancet" }],
    [/cochranelibrary\.com/,              { source_type:"paper",    source_name:"Cochrane Library",                source_family:"cochrane" }],
    [/annals\.org/,                       { source_type:"paper",    source_name:"Annals of Internal Medicine",     source_family:"annals" }],
    [/healthaffairs\.org/,                { source_type:"paper",    source_name:"Health Affairs",                  source_family:"healthaffairs" }],
    [/ahrq\.gov/,                         { source_type:"guideline",source_name:"AHRQ",                            source_family:"ahrq" }],
    [/cms\.gov/,                          { source_type:"guideline",source_name:"CMS",                             source_family:"cms" }],
    [/who\.int/,                          { source_type:"guideline",source_name:"WHO",                             source_family:"who" }],
    [/cdc\.gov/,                          { source_type:"guideline",source_name:"CDC",                             source_family:"cdc" }],
    [/jointcommission\.org/,              { source_type:"guideline",source_name:"Joint Commission",                source_family:"jointcommission" }],
  ];
  for (var i = 0; i < map.length; i++) {
    if (map[i][0].test(h)) return map[i][1];
  }
  return { source_type: existingSourceType||"other", source_name: h, source_family: "unknown" };
}
function isFallbackTitle(title) {
  if (!title || !title.trim()) return true;
  if (/^URL fallback source/i.test(title)) return true;
  if (title === "제목 없음") return true;
  return false;
}
function inferTitleFromUrl(url) {
  var pmid = extractPubMedIdFromUrl(url);
  if (pmid) return "PubMed article PMID " + pmid;
  var pmcid = extractPmcIdFromUrl(url);
  if (pmcid) return "PMC article " + pmcid;
  var doi = extractDoiFromUrl(url);
  if (doi) return "Article linked by DOI " + doi;
  try {
    var u = new URL(url);
    var path = u.pathname.replace(/^\//, "").split("/").slice(0,3).join("/");
    return (u.hostname.replace(/^www\./, "") + (path ? " — " + path : "")).slice(0, 80);
  } catch(e) { return url.slice(0, 80); }
}
function isUsefulAbstract(text) {
  if (!text || !text.trim()) return false;
  if (text === "JSON 파싱 실패로 URL만 추출됨") return false;
  if (text === "초록 없음") return false;
  if (text.length < 40) return false;
  return true;
}
function inferMetadataStatus(c) {
  var hasRealTitle  = c.title && !isFallbackTitle(c.title) && !c.title_inferred;
  var hasAbstract   = isUsefulAbstract(c.abstract);
  var hasIdentifier = c.doi || c.pmid || c.pmcid || (c.url && isValidUrlFormat(c.url));
  var hasMeta       = c.journal || (c.year && c.year !== "unknown");
  var isSnippetOnly = c.fallback_used || isFallbackTitle(c.title);

  if (hasRealTitle && hasAbstract && hasIdentifier) return "complete";
  if (isSnippetOnly && !hasAbstract && (c.title_inferred || isFallbackTitle(c.title))) return "failed_parse";
  if (!hasRealTitle && !c.doi && !c.pmid && !c.pmcid) return "url_only";
  return "partial";
}
function inferSelectionReadiness(c) {
  var hasRealTitle  = c.title && !isFallbackTitle(c.title) && !c.title_inferred;
  var hasAbstract   = isUsefulAbstract(c.abstract) || isUsefulAbstract(c.snippet);
  var hasIdentifier = c.doi || c.pmid || c.pmcid || (c.url && isValidUrlFormat(c.url));
  var hasRelNote    = !!(c.relevance_note && c.relevance_note.trim());
  if (hasRealTitle && hasAbstract && hasIdentifier && hasRelNote) return "ready";
  if (hasIdentifier && (c.doi || c.pmid || c.pmcid || c.source_family !== "unknown")) return "needs_metadata_review";
  return "do_not_select_yet";
}
function buildMetadataNotes(c, extracted) {
  var notes = [];
  if (extracted.doi_from_url) notes.push("URL에서 DOI 추출 성공");
  else if (c.doi)             notes.push("기존 DOI 보존");
  else                        notes.push("DOI 없음");
  if (extracted.pmid)         notes.push("PubMed ID 추출 성공");
  if (extracted.pmcid)        notes.push("PMCID 추출 성공");
  if (extracted.source_family && extracted.source_family !== "unknown")
                              notes.push("source_family 분류: " + extracted.source_family);
  if (c.title_inferred)       notes.push("제목 자동 추정");
  if (!isUsefulAbstract(c.abstract)) notes.push("Abstract 자동 추출 없음");
  if (!c.year || c.year === "unknown") notes.push("연도 정보 없음");
  if (!c.journal)             notes.push("저널 정보 없음");
  return notes;
}

// ── runSourceMetadataExtractorWorker — LLM 없음, 코드 기반만 ─────────────────
// TODO v1.4: fetchPubMedMetadata(pmid) — NCBI E-utilities 서버 proxy 연동
// TODO v1.4: fetchPmcMetadata(pmcid)   — PMC XML 서버 proxy 연동
// TODO v1.5: fetchDoiMetadata(doi)     — Crossref/OpenAlex 서버 proxy 연동
function runSourceMetadataExtractorWorker(candidates) {
  if (!candidates || candidates.length === 0) {
    return { status:"done", parsed:{ enriched_candidates:[] },
      quality:{ inputCount:0, enrichedCount:0, doiExtractedCount:0, pmidExtractedCount:0,
                pmcidExtractedCount:0, readyCount:0, needsMetadataReviewCount:0,
                doNotSelectYetCount:0, completeCount:0, partialCount:0,
                urlOnlyCount:0, failedParseCount:0, fallbackCount:0 } };
  }

  var enriched = [];
  var q = { doiExtractedCount:0, pmidExtractedCount:0, pmcidExtractedCount:0,
             readyCount:0, needsMetadataReviewCount:0, doNotSelectYetCount:0,
             completeCount:0, partialCount:0, urlOnlyCount:0, failedParseCount:0, fallbackCount:0 };

  candidates.forEach(function(c) {
    try {
      var url = c.url || "";
      // 1. DOI 추출
      var doi = c.doi || extractDoiFromUrl(url) || null;
      var doi_from_url = !c.doi && !!doi;
      if (doi_from_url) q.doiExtractedCount++;
      // 2. PMID/PMCID 추출
      var pmid  = extractPubMedIdFromUrl(url) || null;
      var pmcid = extractPmcIdFromUrl(url)    || null;
      if (pmid)  q.pmidExtractedCount++;
      if (pmcid) q.pmcidExtractedCount++;
      // 3. source 분류
      var srcInfo = inferSourceFromUrl(url, c.source_type);
      // 4. abstract 정제
      var abstract = isUsefulAbstract(c.abstract) ? c.abstract : null;
      var snippet  = isUsefulAbstract(c.snippet)  ? c.snippet  : null;
      var abstract_source = abstract ? "search_result" : (snippet ? "snippet" : "none");
      if (!abstract && snippet) abstract = snippet; // snippet을 abstract로 승격
      // 5. title 정제
      var title         = c.title;
      var title_inferred = false;
      var fallback_used  = !!(c.fallback_used);
      if (isFallbackTitle(title)) {
        title          = inferTitleFromUrl(url);
        title_inferred = true;
        fallback_used  = true;
        q.fallbackCount++;
      }
      // 6. enriched candidate 조립
      var enrichedC = Object.assign({}, c, {
        doi:              doi,
        pmid:             pmid,
        pmcid:            pmcid,
        source_type:      srcInfo.source_type,
        source_name:      srcInfo.source_name,
        source_family:    srcInfo.source_family,
        title:            title,
        title_inferred:   title_inferred,
        abstract:         abstract,
        abstract_source:  abstract_source,
        fallback_used:    fallback_used,
        verification:     c.verification || null,
        snippet:          c.snippet,
        relevance_note:   c.relevance_note,
      });
      // 7. metadata_status / selection_readiness / notes
      var extracted = { doi_from_url:doi_from_url, pmid:pmid, pmcid:pmcid, source_family:srcInfo.source_family };
      enrichedC.metadata_status     = inferMetadataStatus(enrichedC);
      enrichedC.selection_readiness = inferSelectionReadiness(enrichedC);
      enrichedC.metadata_notes      = buildMetadataNotes(enrichedC, extracted);

      // 8. quality 집계
      switch(enrichedC.metadata_status) {
        case "complete":     q.completeCount++;     break;
        case "partial":      q.partialCount++;      break;
        case "url_only":     q.urlOnlyCount++;      break;
        case "failed_parse": q.failedParseCount++;  break;
      }
      switch(enrichedC.selection_readiness) {
        case "ready":                  q.readyCount++;              break;
        case "needs_metadata_review":  q.needsMetadataReviewCount++;break;
        case "do_not_select_yet":      q.doNotSelectYetCount++;     break;
      }
      enriched.push(enrichedC);
    } catch(e) {
      // 후보 하나가 실패해도 전체 worker 멈추지 않음
      enriched.push(Object.assign({}, c, {
        metadata_status: "failed_parse", selection_readiness: "do_not_select_yet",
        metadata_notes: ["metadata 추출 오류: " + e.message],
      }));
      q.failedParseCount++;
      q.doNotSelectYetCount++;
    }
  });

  return {
    status: "done",
    parsed: { enriched_candidates: enriched },
    quality: Object.assign({ inputCount: candidates.length, enrichedCount: enriched.length }, q),
  };
}
function isValidUrlFormat(url) {
  if (!url || typeof url !== "string") return false;
  try { new URL(url); return true; } catch(e) { return false; }
}
function isPlaceholderUrl(url) {
  if (!url) return false;
  var u = url.toLowerCase();
  return /example[.]com|placeholder|\bfake\b|localhost|test[.]com/.test(u);
}
function scoreCandidateVerification(c, checks) {
  var score = 0;
  if (checks.doi_format_valid)          score += 35;
  if (checks.url_format_valid)          score += 30;
  if (checks.has_title)                 score += 20;
  if (c.year && c.year !== "unknown")   score += 5;
  if (c.journal || c.source_type)       score += 5;
  if (c.snippet || c.abstract)          score += 5;
  if (checks.url_placeholder_suspected) score -= 40;
  return Math.max(0, Math.min(100, score));
}
function verifySingleCandidate(c) {
  var has_title           = !!(c.title && c.title.trim() && c.title !== "제목 없음");
  var doi_format_valid    = isValidDoiFormat(c.doi);
  var url_format_valid    = isValidUrlFormat(c.url);
  var url_placeholder_suspected = isPlaceholderUrl(c.url);
  var has_identifier      = doi_format_valid || (url_format_valid && !url_placeholder_suspected);
  var notes = [];
  if (!has_title)                notes.push("제목 없음");
  if (doi_format_valid)          notes.push("DOI 형식 유효");
  else if (c.doi)                notes.push("DOI 형식 불량: " + c.doi);
  else                           notes.push("DOI 없음");
  if (url_format_valid)          notes.push("URL 형식 유효");
  else                           notes.push("URL 형식 불량");
  if (url_placeholder_suspected) notes.push("placeholder URL 의심");
  var checks = {
    doi_format_valid: doi_format_valid, url_format_valid: url_format_valid,
    url_placeholder_suspected: url_placeholder_suspected,
    has_title: has_title, has_identifier: has_identifier
  };
  var confidence_score = scoreCandidateVerification(c, checks);
  var status;
  if (!has_title || !has_identifier)  status = "rejected";
  else if (url_placeholder_suspected) status = "rejected";
  else if (confidence_score >= 75)    status = "verified";
  else if (confidence_score >= 45)    status = "needs_review";
  else                                status = "rejected";
  // TODO v1.2: doi.org resolve (실제 DOI 접속 검증)
  // TODO v1.2: URL HEAD 요청으로 실제 존재 여부 확인
  // TODO v1.2: Crossref/OpenAlex/PubMed API 메타데이터 교차검증
  return { doi_format_valid:doi_format_valid, url_format_valid:url_format_valid,
           url_placeholder_suspected:url_placeholder_suspected,
           has_title:has_title, has_identifier:has_identifier,
           confidence_score:confidence_score, status:status, verification_notes:notes };
}

// ── runCandidateExistenceVerifierWorker — LLM 없음, 코드 rule만 사용 ─────────
function runCandidateExistenceVerifierWorker(candidatePapers) {
  if (!candidatePapers || candidatePapers.length === 0) {
    return { status:"done",
             parsed:{ verified_candidates:[], rejected_candidates:[] },
             quality:{ inputCount:0, verifiedCount:0, needsReviewCount:0,
                       rejectedCount:0, passableCount:0, rejectionRate:0 } };
  }
  var verified = [], rejected = [], vCount = 0, nrCount = 0, rCount = 0;
  candidatePapers.forEach(function(c) {
    var v = verifySingleCandidate(c);
    var enriched = Object.assign({}, c, { verification: v });
    if (v.status === "rejected") { rejected.push(enriched); rCount++; }
    else { verified.push(enriched); if (v.status === "verified") vCount++; else nrCount++; }
  });
  var passableCount = vCount + nrCount;
  var total = candidatePapers.length;
  return {
    status: "done",
    parsed: {
      verified_candidates: verified,  // verified + needs_review (passable)
      rejected_candidates: rejected,
    },
    quality: { inputCount:total, verifiedCount:vCount, needsReviewCount:nrCount,
               rejectedCount:rCount, passableCount:passableCount,
               rejectionRate:total > 0 ? parseFloat((rCount/total).toFixed(2)) : 0 },
  };
}

// ── workers ───────────────────────────────────────────────────────────────────
const BOTTLENECK_STRUCT_SYS_PROMPT=`당신은 의료·운영 리서치 병목 분석 전문가입니다. 사용자 원문을 보존하면서 병목 가설을 구조화하세요.
규칙: user_original_question은 원문 그대로 복사. domain_anchor_terms는 영어 핵심 검색어. must_preserve_terms는 원문에서 절대 희석하면 안 되는 한국어 표현.
search_queries 4개 필수. 순수 JSON만 출력:
{"user_original_question":"원문 그대로","bottleneck_hypothesis":"...","domain_anchor_terms":["postoperative","surgical","30-day readmission"],"must_preserve_terms":["수술 후","30일 재입원률"],"target_context":{"population":"...","setting":"...","outcome":"..."},"concept_groups":{"problem_terms":[],"operation_terms":[],"data_terms":[],"business_terms":[]},"search_queries":["q1","q2","q3","q4"]}`;

async function runBottleneckStructuringWorker(question){
  try{
    const raw=await callLLM(BOTTLENECK_STRUCT_SYS_PROMPT,"병목 가설: "+question);
    const parsed=safeParseJSON(raw);
    if(!parsed||!parsed.bottleneck_hypothesis||!parsed.target_context||!parsed.target_context.population) throw new Error("구조화 응답 형식 오류");
    // user_original_question: LLM이 빠뜨리면 코드에서 직접 보존
    if(!parsed.user_original_question||!parsed.user_original_question.trim())
      parsed.user_original_question = question;
    if(!Array.isArray(parsed.domain_anchor_terms)) parsed.domain_anchor_terms=[];
    if(!Array.isArray(parsed.must_preserve_terms)) parsed.must_preserve_terms=[];
    return{status:"done",parsed,quality:{hasHypothesis:true,hasContext:!!(parsed.target_context&&parsed.target_context.population&&parsed.target_context.setting&&parsed.target_context.outcome),queryCount:(parsed.search_queries||[]).length}};
  }catch(e){return{status:"error",error:e.message,retryable:true};}
}

const SEARCH_STRATEGY_SYS_PROMPT=`당신은 체계적 문헌 검색 전략 전문가입니다. domain_anchor_terms와 must_preserve_terms를 반드시 쿼리에 반영하세요.
search_queries 4개 이상 필수. covered_terms는 이 쿼리가 반영한 핵심어 목록. query_axis는 problem|operation|data_method|intervention|review 중 하나. 순수 JSON:
{"search_queries":[{"query":"...","purpose":"...","source_preference":"paper|guideline|case","covered_terms":["postoperative","30-day readmission"],"query_axis":"operation"}],"inclusion_criteria":[],"exclusion_criteria":[]}`;

async function runSearchStrategyWorker(hypothesis,context,concepts,originalQuestion,anchorTerms,preserveTerms){
  try{
    const anchorStr=(Array.isArray(anchorTerms)&&anchorTerms.length>0)?"\n핵심 검색어(반드시 쿼리에 반영): "+anchorTerms.join(", "):"";
    const preserveStr=(Array.isArray(preserveTerms)&&preserveTerms.length>0)?"\n보존 필수 표현: "+preserveTerms.join(", "):"";
    const origStr=originalQuestion?"\n사용자 원문: "+originalQuestion:"";
    const prompt="병목 가설: "+hypothesis+origStr+anchorStr+preserveStr+"\n연구 맥락: "+JSON.stringify(context)+"\n핵심 개념: "+JSON.stringify(concepts)+"\n\n검색 전략 수립. 쿼리 4개 이상. 각 쿼리에 covered_terms와 query_axis 포함.";
    const raw=await callLLM(SEARCH_STRATEGY_SYS_PROMPT,prompt);
    const parsed=safeParseJSON(raw);
    if(!parsed||!Array.isArray(parsed.search_queries)||parsed.search_queries.length<4) throw new Error("쿼리 4개 미만");
    const prefs=new Set(parsed.search_queries.map(q=>q.source_preference));
    return{status:"done",parsed,quality:{queryCount:parsed.search_queries.length,hasDiverseQueries:prefs.size>=2}};
  }catch(e){return{status:"error",error:e.message,retryable:true};}
}

const PAPER_SEARCH_SYS_PROMPT=`당신은 의학 논문 검색 전문가입니다. web_search 툴로 실제 존재하는 논문/자료를 검색하세요.
반드시 실제 URL과 DOI가 있는 자료만 포함하세요. 가짜 URL이나 존재하지 않는 DOI는 절대 포함하지 마세요.
최대 5개. 순수 JSON만 출력:
{"sources":[{"title":"...","url":"https://실제URL","year":"연도","journal":"저널명","source_type":"paper|guideline|case_study|news|other","snippet":"핵심 내용 요약","doi":"10.xxxx/xxxxx 또는 null"}]}`;

async function searchOnePaperQuery(queryObj,prefix){
  try{
    const q=typeof queryObj==="string"?queryObj:(queryObj.query||"");
    var raw="";
    try{
      raw=await callLLMReal(PAPER_SEARCH_SYS_PROMPT,"검색어: "+q+(queryObj.purpose?" (목적: "+queryObj.purpose+")":""));
    }catch(apiErr){
      return{sources:[],failed:true,failReason:"api_error: "+apiErr.message,rawPreview:""};
    }
    if(!raw||raw.trim()==="") return{sources:[],failed:true,failReason:"empty_response",rawPreview:""};
    var rawPreview=raw.slice(0,500);
    var p=safeParseJSON(raw);
    if(p&&Array.isArray(p.sources)){
      const valid=p.sources.filter(s=>s&&s.url&&s.url.startsWith("http")).map(function(s,i){return Object.assign({},s,{id:prefix+(i+1)});});
      if(valid.length>0) return{sources:valid,failed:false,rawPreview:rawPreview};
      return{sources:[],failed:true,failReason:"no_valid_url",rawPreview:rawPreview};
    }
    // JSON 파싱 실패 시 URL fallback
    var urlMatches=[];
    var urlRe=/https?:\/\/[^\s)"']+/g;
    var m;
    while((m=urlRe.exec(raw))!==null) urlMatches.push(m[0]);
    if(urlMatches.length>0){
      return{
        sources:urlMatches.slice(0,5).map(function(url,i){
          return{id:prefix+(i+1),title:"URL fallback source "+(i+1),url:url,year:"unknown",journal:null,source_type:"other",snippet:"JSON 파싱 실패로 URL만 추출됨",doi:null};
        }),
        failed:false,fallbackUsed:true,failReason:"json_parse_failed_url_fallback",rawPreview:rawPreview
      };
    }
    return{sources:[],failed:true,failReason:"json_parse_failed",rawPreview:rawPreview};
  }catch(e){return{sources:[],failed:true,failReason:"api_error: "+e.message,rawPreview:""};}
}

// ── runVerifiedSearchLoop — 검색-검증 루프 컨트롤러 ────────────────────────
// G3 hard block 없음 — 0편이어도 retry 진행. 차단은 G3.5(passableCount)만 담당.
async function runVerifiedSearchLoop(searchQueryObjects, minPassable, maxRetry) {
  minPassable = minPassable || 5;
  maxRetry    = maxRetry    || 2;

  var allPassable   = [];
  var allRejected   = [];
  var allCandidates = [];
  var rejectedUrls  = new Set();
  var retryCount    = 0;
  var attemptCount  = 0;
  var lastR3        = null;
  var searchAttempts= [];
  var totalRawCount = 0;
  var totalFailedCount = 0;

  var currentQueries = searchQueryObjects;

  while (true) {
    attemptCount++;
    var r3 = await runPaperSearchWorker(currentQueries);
    lastR3 = r3;
    var rawCount    = (r3.quality && r3.quality.rawCount)    || 0;
    var uniqueCount = (r3.quality && r3.quality.uniqueCount) || 0;
    var failedCount = (r3.quality && r3.quality.failedCount) || 0;
    totalRawCount    += rawCount;
    totalFailedCount += failedCount;

    var candidates = (r3.parsed && r3.parsed.candidate_papers) || [];

    // 이미 rejected된 URL 제외
    var newCandidates = candidates.filter(function(c) {
      return !rejectedUrls.has((c.url || "").toLowerCase());
    });

    // 검증
    var vr = runCandidateExistenceVerifierWorker(newCandidates);
    var passable = vr.parsed.verified_candidates || [];
    var rejected = vr.parsed.rejected_candidates || [];

    // rejected URL 누적
    rejected.forEach(function(c) {
      if (c.url) rejectedUrls.add(c.url.toLowerCase());
    });

    // passable 누적 (URL 중복 제거)
    passable.forEach(function(c) {
      var alreadyIn = allPassable.some(function(p) {
        return (p.url || "").toLowerCase() === (c.url || "").toLowerCase();
      });
      if (!alreadyIn) allPassable.push(c);
    });
    allRejected = allRejected.concat(rejected);
    allCandidates = allCandidates.concat(newCandidates);

    searchAttempts.push({
      attempt: attemptCount,
      querySet: currentQueries.map(function(q){ return typeof q==="string"?q:(q.query||""); }),
      rawCount: rawCount,
      uniqueCount: uniqueCount,
      failedCount: failedCount,
      passableCountAfterVerify: allPassable.length,
      failed_details: (r3.parsed && r3.parsed.failed_details) || [],
    });

    // 목표 달성 또는 재시도 한도 초과
    if (allPassable.length >= minPassable || retryCount >= maxRetry) break;

    retryCount++;
    // 재시도: 쿼리 확장 (기존 쿼리 뒤에 "systematic review evidence" 추가)
    currentQueries = searchQueryObjects.map(function(q, i) {
      if (i < 2) return q; // 앞 2개는 원본 유지
      var orig = typeof q === "string" ? q : (q.query || "");
      return Object.assign({}, q, { query: orig + " systematic review evidence" });
    });
  }

  // 최종 verifierWorker 결과 재조합
  var finalVR = runCandidateExistenceVerifierWorker(allPassable);
  return {
    status: "done",
    parsed: {
      verified_candidates: allPassable,
      rejected_candidates: allRejected,
      all_candidates:      allCandidates,
      search_attempts:     searchAttempts,
    },
    quality: {
      inputCount:       allPassable.length + allRejected.length,
      verifiedCount:    finalVR.quality.verifiedCount,
      needsReviewCount: finalVR.quality.needsReviewCount,
      rejectedCount:    allRejected.length,
      passableCount:    allPassable.length,
      retryCount:       retryCount,
      attemptCount:     attemptCount,
      totalRawCount:    totalRawCount,
      totalUniqueCount: allCandidates.length,
      totalFailedCount: totalFailedCount,
      rejectionRate:    (allPassable.length + allRejected.length) > 0
                          ? parseFloat((allRejected.length / (allPassable.length + allRejected.length)).toFixed(2))
                          : 0,
    },
    lastSearchResult: lastR3,
  };
}

async function runPaperSearchWorker(searchQueryObjects){
  const prefixes=["A","B","C","D"],target=(Array.isArray(searchQueryObjects)?searchQueryObjects:[]).slice(0,4);
  const results=await Promise.all(target.map((q,i)=>searchOnePaperQuery(q,prefixes[i]||("X"+i))));
  const batches=results.flatMap(r=>r.sources);
  const failedIdx=target.filter((_,i)=>results[i].failed);
  const failed_details=target.reduce(function(acc,q,i){
    if(results[i].failed) acc.push({query:typeof q==="string"?q:(q.query||""),reason:results[i].failReason||"unknown",rawPreview:results[i].rawPreview||""});
    return acc;
  },[]);
  const deduped=dedupSources(batches);
  const candidate_papers=deduped.map((s,i)=>({
    id:"P"+(i+1),title:s.title||"제목 없음",url:s.url,year:s.year||"unknown",
    journal:s.journal||null,source_type:s.source_type||"other",snippet:s.snippet||"",
    doi:(s.doi&&s.doi!=="없음"&&s.doi!=="none")?s.doi:null,
    credibility:(s.source_type==="paper"||s.source_type==="guideline")?"high":"medium",
  }));
  return{status:"done",parsed:{candidate_papers,failed_queries:failedIdx.map(q=>typeof q==="string"?q:(q.query||"")),failed_details:failed_details},quality:{rawCount:deduped.length,uniqueCount:candidate_papers.length,failedCount:failedIdx.length,queryCoverage:target.length>0?Math.round((target.length-failedIdx.length)/target.length*100):0}};
}

const METADATA_NORMALIZER_SYS_PROMPT=`메타데이터 정규화 전문가. study_type: RCT|cohort|systematic_review|case_study|unknown. data_type: EHR|claims|survey|mixed|unknown. 순수 JSON:
{"normalized_candidates":[{"id":"P1","title":"...","url":"...","doi":"...","year":"...","journal":"...","abstract":"...","source_type":"paper","study_type":"...","data_type":"...","relevance_note":"..."}],"missing_fields_summary":{"missing_abstract":0,"missing_doi":0,"missing_year":0,"missing_journal":0}}`;

async function runCandidateMetadataNormalizerWorker(papers){
  if(!papers||papers.length===0) return{status:"done",parsed:{normalized_candidates:[],missing_fields_summary:{missing_abstract:0,missing_doi:0,missing_year:0,missing_journal:0}},quality:{totalCount:0,abstractCoverageRatio:0,doiCoverageRatio:0}};
  try{
    const prompt="후보 논문 목록 ("+papers.length+"편):\n"+JSON.stringify(papers,null,2)+"\n\n메타데이터를 정규화하고 보강하세요.";
    const raw=await callLLM(METADATA_NORMALIZER_SYS_PROMPT,prompt);
    const pr=safeParseJSON(raw);
    if(!pr||!Array.isArray(pr.normalized_candidates)){
      const fb=papers.map(p=>({id:p.id,title:p.title,url:p.url,doi:p.doi||null,year:p.year||"unknown",journal:p.journal||null,abstract:p.snippet||null,source_type:p.source_type||"other",study_type:"unknown",data_type:"unknown",relevance_note:"정규화 실패 — 원본 유지",verification:p.verification||null}));
      const ms={missing_abstract:fb.filter(p=>!p.abstract).length,missing_doi:fb.filter(p=>!p.doi).length,missing_year:fb.filter(p=>!p.year||p.year==="unknown").length,missing_journal:fb.filter(p=>!p.journal).length};
      return{status:"done",parsed:{normalized_candidates:fb,missing_fields_summary:ms},quality:{totalCount:fb.length,abstractCoverageRatio:parseFloat(((fb.length-ms.missing_abstract)/fb.length).toFixed(2)),doiCoverageRatio:parseFloat(((fb.length-ms.missing_doi)/fb.length).toFixed(2))},note:"정규화 실패 — 최소 변환 폴백"};
    }
    // id 기반 verification + enriched fields 복원 — LLM이 빼도 원본에서 재부착
    const metaMap=new Map(papers.map(p=>[p.id,{
      verification:p.verification||null,
      pmid:p.pmid||null, pmcid:p.pmcid||null,
      source_name:p.source_name||null, source_family:p.source_family||null,
      title_inferred:p.title_inferred||false, abstract_source:p.abstract_source||null,
      metadata_status:p.metadata_status||null, selection_readiness:p.selection_readiness||null,
      metadata_notes:p.metadata_notes||[], fallback_used:p.fallback_used||false,
    }]));
    pr.normalized_candidates=pr.normalized_candidates.map(function(c){
      var m=metaMap.get(c.id)||{};
      return Object.assign({},c,m,{
        verification:c.verification||m.verification||null,
        metadata_status:c.metadata_status||m.metadata_status||null,
        selection_readiness:c.selection_readiness||m.selection_readiness||null,
      });
    });
    let ma=0,md=0,my=0,mj=0;
    pr.normalized_candidates.forEach(c=>{if(!c.abstract)ma++;if(!c.doi)md++;if(!c.year||c.year==="unknown")my++;if(!c.journal)mj++;});
    const total=pr.normalized_candidates.length;
    return{status:"done",parsed:{normalized_candidates:pr.normalized_candidates,missing_fields_summary:{missing_abstract:ma,missing_doi:md,missing_year:my,missing_journal:mj}},quality:{totalCount:total,abstractCoverageRatio:total>0?parseFloat(((total-ma)/total).toFixed(2)):0,doiCoverageRatio:total>0?parseFloat(((total-md)/total).toFixed(2)):0}};
  }catch(e){
    const fb=papers.map(p=>({id:p.id,title:p.title,url:p.url,doi:p.doi||null,year:p.year||"unknown",journal:p.journal||null,abstract:p.snippet||null,source_type:p.source_type||"other",study_type:"unknown",data_type:"unknown",relevance_note:"오류 폴백",verification:p.verification||null}));
    return{status:"done",parsed:{normalized_candidates:fb,missing_fields_summary:{missing_abstract:fb.filter(p=>!p.abstract).length,missing_doi:fb.filter(p=>!p.doi).length,missing_year:0,missing_journal:fb.filter(p=>!p.journal).length}},quality:{totalCount:fb.length,abstractCoverageRatio:0.5,doiCoverageRatio:0.3},note:"정규화 LLM 오류 폴백: "+e.message};
  }
}

const CANDIDATE_FILTER_SYS_PROMPT=`1차 스크리닝 전문가. 최종 선정 금지. screening_tags: has_abstract|recent_5yr|hospital_ops_relevant|data_method_clear. 순수 JSON:
{"filtered_candidates":[{"id":"P1","title":"...","url":"...","year":"...","journal":"...","doi":"...","study_type":"...","data_type":"...","abstract":"...","relevance_note":"...","screening_tags":["has_abstract"]}],"excluded":[{"id":"P3","reason":"..."}]}`;

async function runCandidateFilterWorker(candidates,hypothesis){
  if(!candidates||candidates.length===0) return{status:"done",parsed:{filtered_candidates:[],excluded:[]},quality:{filteredCount:0,excludedCount:0,avgTagCount:0}};
  try{
    const prompt="병목 가설: "+hypothesis+"\n\n후보 논문 ("+candidates.length+"편):\n"+JSON.stringify(candidates,null,2)+"\n\n1차 스크리닝 수행. 가능성 있는 후보 최대한 유지.";
    const raw=await callLLM(CANDIDATE_FILTER_SYS_PROMPT,prompt);
    const pr=safeParseJSON(raw);
    if(!pr||!Array.isArray(pr.filtered_candidates)){
      const fb={filtered_candidates:candidates.map(c=>Object.assign({},c,{screening_tags:[]})),excluded:[]};
      return{status:"done",parsed:fb,quality:{filteredCount:candidates.length,excludedCount:0,avgTagCount:0},warning:"필터 LLM 실패 — 전체 유지"};
    }
    var fc=pr.filtered_candidates||[];
    // id 기반 verification + enriched fields 복원 — LLM이 필드를 제거해도 원본에서 재부착
    const metaMapF=new Map(candidates.map(c=>[c.id,{
      verification:c.verification||null,
      pmid:c.pmid||null, pmcid:c.pmcid||null,
      source_name:c.source_name||null, source_family:c.source_family||null,
      title_inferred:c.title_inferred||false, abstract_source:c.abstract_source||null,
      metadata_status:c.metadata_status||null, selection_readiness:c.selection_readiness||null,
      metadata_notes:c.metadata_notes||[], fallback_used:c.fallback_used||false,
    }]));
    fc=fc.map(function(c){
      var m=metaMapF.get(c.id)||{};
      var enriched=Object.assign({},c,m,{
        verification:c.verification||m.verification||null,
        metadata_status:c.metadata_status||m.metadata_status||null,
        selection_readiness:c.selection_readiness||m.selection_readiness||null,
      });
      // 신규 screening_tags 자동 추가
      var tags=Array.isArray(enriched.screening_tags)?enriched.screening_tags.slice():[];
      if(enriched.selection_readiness==="ready"&&!tags.includes("metadata_ready")) tags.push("metadata_ready");
      if(enriched.selection_readiness==="needs_metadata_review"&&!tags.includes("needs_metadata_review")) tags.push("needs_metadata_review");
      if(enriched.metadata_status==="url_only"&&!tags.includes("url_only")) tags.push("url_only");
      if(enriched.doi&&!tags.includes("doi_found")) tags.push("doi_found");
      if(enriched.pmid&&!tags.includes("pmid_found")) tags.push("pmid_found");
      if(enriched.pmcid&&!tags.includes("pmcid_found")) tags.push("pmcid_found");
      if(enriched.title_inferred&&!tags.includes("title_inferred")) tags.push("title_inferred");
      enriched.screening_tags=tags;
      return enriched;
    });
    const avgTag=fc.length>0?parseFloat((fc.reduce((s,c)=>s+(c.screening_tags||[]).length,0)/fc.length).toFixed(2)):0;
    return{status:"done",parsed:{filtered_candidates:fc,excluded:pr.excluded||[]},quality:{filteredCount:fc.length,excludedCount:(pr.excluded||[]).length,avgTagCount:avgTag}};
  }catch(e){
    return{status:"done",parsed:{filtered_candidates:candidates.map(c=>Object.assign({},c,{screening_tags:[]})),excluded:[]},quality:{filteredCount:candidates.length,excludedCount:0,avgTagCount:0},warning:"오류 — 전체 유지: "+e.message};
  }
}


// ── buildSelectionAnalystPrompt (deterministic 조립) ─────────────────────────
// LLM에 맡기지 않고 코드에서 직접 조립 — 후보 목록 누락 구조적 방지
function buildSelectionAnalystPrompt(hypothesis, context, candidates, originalQuestion, anchorTerms) {
  var readyCandidates = candidates.filter(function(c){ return c.selection_readiness === "ready"; });
  var hasReadyShortage = readyCandidates.length < 3;

  const candidateBlock = candidates.map(function(c, i) {
    var abstract = c.abstract || c.snippet || c.relevance_note || "초록 없음";
    var tags = (c.screening_tags || []);
    if (tags.length === 0) {
      if (c.abstract || c.snippet) tags.push("has_abstract");
      if (c.year && parseInt(c.year) >= 2020) tags.push("recent_5yr");
      var titleL = (c.title || "").toLowerCase();
      if (titleL.includes("surgical")||titleL.includes("postoperative")) tags.push("surgical_relevant");
      if (titleL.includes("hospital")||titleL.includes("readmission")||titleL.includes("workflow")) tags.push("hospital_ops_relevant");
      if (c.study_type && c.study_type !== "unknown") tags.push("data_method_clear");
    }
    return [
      "---",
      "[" + (i + 1) + "] " + (c.id || "") + " | " + (c.title || "제목 없음"),
      "• 연도: " + (c.year || "unknown"),
      "• 저널: " + (c.journal || c.source_type || "unknown"),
      "• DOI: " + (c.doi || "없음"),
      "• PMID: " + (c.pmid || "없음"),
      "• PMCID: " + (c.pmcid || "없음"),
      "• URL: " + (c.url || "없음"),
      "• Source family: " + (c.source_family || "unknown"),
      "• Source name: " + (c.source_name || "unknown"),
      "• 연구유형: " + (c.study_type || "unknown"),
      "• 데이터유형: " + (c.data_type || "unknown"),
      "• Metadata status: " + (c.metadata_status || "unknown"),
      "• Selection readiness: " + (c.selection_readiness || "unknown"),
      "• Metadata notes: " + ((c.metadata_notes && c.metadata_notes.length > 0) ? c.metadata_notes.join(", ") : "없음"),
      "• 제목 추정 여부: " + (c.title_inferred ? "true" : "false"),
      "• Abstract source: " + (c.abstract_source || "none"),
      "• Fallback used: " + (c.fallback_used ? "true" : "false"),
      "• 스크리닝 태그: " + (tags.join(", ") || "없음"),
      "• 관련성 메모: " + (c.relevance_note || "없음"),
      "• 검증 상태: " + (c.verification ? c.verification.status : "not_checked"),
      "• 검증 점수: " + (c.verification ? c.verification.confidence_score : "—"),
      "• 검증 메모: " + (c.verification && c.verification.verification_notes ? c.verification.verification_notes.join(", ") : "—"),
      "• 초록/요약:",
      abstract,
    ].join("\n");
  }).join("\n\n");

  const origSection = originalQuestion ? ["", "[사용자 원문 질문]", originalQuestion] : [];
  const anchorSection = (Array.isArray(anchorTerms) && anchorTerms.length > 0)
    ? ["", "[검색 초점 — 반드시 이 키워드 관련 논문 우선 평가]", anchorTerms.join(" / ")]
    : [];

  var parts = [
    "너는 Paper Selection Analyst다.",
    "아래 병목 가설과 후보 논문 목록을 바탕으로, NotebookLM 및 Paper Analysis Agent에 넣을 논문 1~3편을 선정하라.",
    "",
    "[중요 지침 — 반드시 준수]",
    "- 새로운 웹 검색을 하지 말 것.",
    "- 제공된 후보 정보만 기준으로 평가할 것.",
    "- PDF 원문 분석을 하지 말 것.",
    "- Abstract 전문이 없는 후보는 억지로 해석하지 말 것.",
    "- selection_readiness가 ready인 후보를 최우선 평가할 것.",
    "- 정보가 부족한 후보는 Top 3에 넣지 말고 needs_metadata_review로 보류할 것.",
    "- URL fallback 후보(fallback_used: true)는 Metadata Readiness 점수를 낮게 평가할 것.",
    "- title_inferred: true인 후보는 실제 논문 제목이 아님 — 선정 시 주의할 것.",
    hasReadyShortage
      ? "- ⚠ ready 후보가 3편 미만입니다. Top 3 선정 대신 메타데이터 확인 우선순위를 먼저 제시할 것."
      : "- ready 후보를 중심으로 Top 3를 선정하고, 나머지는 보류 처리할 것.",
  ];
  if (origSection.length) parts = parts.concat(origSection);
  parts = parts.concat(["", "[구조화된 병목 가설]", hypothesis]);
  if (anchorSection.length) parts = parts.concat(anchorSection);
  parts = parts.concat([
    "",
    "[연구 맥락]",
    "• Population: " + ((context && context.population) || ""),
    "• Setting: " + ((context && context.setting) || ""),
    "• Outcome: " + ((context && context.outcome) || ""),
    "",
    "[후보 논문 목록 — " + candidates.length + "편 (ready: " + readyCandidates.length + "편)]",
    candidateBlock,
    "",
    "[평가 기준]",
    "1. Bottleneck Fit: 병목 가설과의 직접 연결성 (1~5점)",
    "2. Data/Method Fit: EHR·청구데이터·방법론 적용 가능성 (1~5점)",
    "3. Business Insight Potential: 병원 운영·비용·워크플로우 인사이트 번역 가능성 (1~5점)",
    "4. Evidence Strength: 연구 설계·저널 신뢰도 (1~5점)",
    "5. Metadata Readiness: 제목·초록·DOI·저널·연도 등 선별 판단에 필요한 정보가 충분한가 (1~5점)",
    "",
    "[출력 요청]",
    hasReadyShortage
      ? "- ready 후보 부족 — 메타데이터 확인 우선순위 목록을 먼저 제시 (URL/DOI/PMID 기준)"
      : "- Top 3 선정: 각 논문에 대해 5개 기준 점수 + 선정 이유",
    "- ready 후보 / needs_metadata_review 후보 / 제외 후보를 분리하여 표시",
    "- 제외/보류 논문 목록 (이유 포함)",
    "- NotebookLM 투입 우선 URL/DOI와 PDF 확보 필요 여부 표시",
    "- 각 논문별 분석 집중 섹션 추천 (Abstract, Methods, Results, Discussion 중)",
  ]);
  return parts.join("\n");
}

const HANDOFF_PACKAGE_SYS_PROMPT=`전달 패키지 생성 전문가. selection_analyst_prompt는 코드에서 자동 생성되므로 빈 문자열로 두세요.
반드시 순수 JSON 한 줄로만 출력:
{"handoff_to":"Paper Selection Analyst","bottleneck_hypothesis":"...","selection_goal":"...","candidate_count":0,"suggested_evaluation_rubric":{"bottleneck_fit":"...","data_method_fit":"...","business_insight_potential":"...","evidence_strength":"..."},"known_limitations":[],"notes_for_selection_analyst":[],"selection_analyst_prompt":""}`;

async function runHandoffPackageWorker(hypothesis,context,candidates,originalQuestion,anchorTerms){
  try{
    const prompt="병목 가설: "+hypothesis+"\n연구 맥락: "+JSON.stringify(context)+"\n\n필터링된 후보 ("+candidates.length+"편):\n"+JSON.stringify(candidates.map(c=>({id:c.id,title:c.title,year:c.year,journal:c.journal,url:c.url,doi:c.doi,abstract:c.abstract||c.snippet||null,study_type:c.study_type,data_type:c.data_type,screening_tags:c.screening_tags,relevance_note:c.relevance_note})),null,2)+"\n\n전달 패키지 생성. selection_analyst_prompt는 완성형으로 작성.";
    const raw=await callLLM(HANDOFF_PACKAGE_SYS_PROMPT,prompt);
    const pr=safeParseJSON(raw);
    // 파싱 실패 또는 핵심 필드 누락 시 → 최소 폴백 패키지 생성 (파이프라인 차단 금지)
    const parsed = pr || {};
    if(!Array.isArray(parsed.candidate_papers)) parsed.candidate_papers=candidates;
    if(!Array.isArray(parsed.known_limitations)) parsed.known_limitations=[];
    if(!Array.isArray(parsed.notes_for_selection_analyst)) parsed.notes_for_selection_analyst=[];
    if(!parsed.handoff_to) parsed.handoff_to="Paper Selection Analyst";
    if(!parsed.bottleneck_hypothesis) parsed.bottleneck_hypothesis=hypothesis;
    if(!parsed.selection_goal) parsed.selection_goal="NotebookLM 및 Paper Analysis Agent에 투입할 핵심 논문 1~3편 선정";
    if(!parsed.suggested_evaluation_rubric) parsed.suggested_evaluation_rubric={bottleneck_fit:"병목 가설과의 직접 연결성",data_method_fit:"데이터/방법론 적용 가능성",business_insight_potential:"운영 인사이트 번역 가능성",evidence_strength:"연구 설계 신뢰도"};
    // selection_analyst_prompt는 항상 deterministic 조립 — LLM 생성값 무시, 후보 목록 누락 방지
    parsed.selection_analyst_prompt = buildSelectionAnalystPrompt(hypothesis, context, candidates, originalQuestion, anchorTerms);
    return{status:"done",parsed:parsed,quality:{candidateCount:(parsed.candidate_papers||[]).length,hasPrompt:!!(parsed.selection_analyst_prompt&&parsed.selection_analyst_prompt.trim()),hasRubric:!!(parsed.suggested_evaluation_rubric&&Object.keys(parsed.suggested_evaluation_rubric).length>0)}};
  }catch(e){
    // 예외 발생해도 최소 패키지 반환 — error 상태 금지
    const fallback={handoff_to:"Paper Selection Analyst",bottleneck_hypothesis:hypothesis,selection_goal:"NotebookLM 및 Paper Analysis Agent에 투입할 핵심 논문 1~3편 선정",candidate_count:candidates.length,candidate_papers:candidates,known_limitations:["handoffPackageWorker 오류로 인한 최소 폴백 패키지"],notes_for_selection_analyst:[],suggested_evaluation_rubric:{bottleneck_fit:"병목 직접 연결성",data_method_fit:"데이터/방법론 적합성",business_insight_potential:"운영 인사이트 가능성",evidence_strength:"연구 신뢰도"},selection_analyst_prompt:buildSelectionAnalystPrompt(hypothesis, context, candidates, originalQuestion, anchorTerms)};
    return{status:"done",parsed:fallback,quality:{candidateCount:candidates.length,hasPrompt:true,hasRubric:true},note:"handoffWorker 오류 — 폴백 패키지: "+e.message};
  }
}

// ── useResearchPipeline hook ──────────────────────────────────────────────────
function useResearchPipeline(workers,stageUiList){
  const[question,setQuestion]=useState("");
  const[status,setStatus]=useState("idle");
  const[stageResults,setStageResults]=useState({});
  const[currentStage,setCurrentStage]=useState(null);
  const[log,setLog]=useState([]);
  const[started,setStarted]=useState(false);
  const abortRef=useRef(false);

  const addLog=(msg,color)=>{color=color||"#546E7A";setLog(prev=>prev.concat([{msg,color,time:new Date().toLocaleTimeString("ko-KR")}]));};
  const setResult=(id,r)=>setStageResults(prev=>Object.assign({},prev,{[id]:r}));
  function blockStagesFrom(fromId,gateId,reason){
    const ids=stageUiList.map(s=>s.id),idx=ids.indexOf(fromId);
    if(idx===-1){console.warn("blockStagesFrom: unknown stage id",fromId);return;}
    for(let i=idx;i<ids.length;i++) setResult(ids[i],{status:"skipped",error:gateId+" 차단으로 건너뜀"});
    setResult(fromId,{status:"gate_blocked",gate:gateId,error:reason,retryable:true});
  }
  function reset(){abortRef.current=true;setQuestion("");setStatus("idle");setStageResults({});setCurrentStage(null);setLog([]);setStarted(false);}

  async function runResearch(){
    if(!question.trim()) return;
    setStarted(true);setStageResults({});setLog([]);abortRef.current=false;
    addLog("▶ Paper Research Pipeline v1.0 초기화","#4FC3F7");
    addLog("▶ 병목 가설: \""+question+"\"","#80DEEA");
    addLog("▶ 8단계: 구조화 → 전략 → 수집/검증 루프 → 출처 메타데이터 보강 → 정규화 → 필터 → 전달 패키지","#81C784");

    const{runBottleneckStructuringWorker:rBS,runSearchStrategyWorker:rSS,runVerifiedSearchLoop:rVSL,runSourceMetadataExtractorWorker:rSME,runCandidateMetadataNormalizerWorker:rMN,runCandidateFilterWorker:rCF,runHandoffPackageWorker:rHP}=workers;

    // Worker 1
    setCurrentStage("structuring");setStatus("structuring");
    addLog("◉ [🧩 bottleneckStructuringWorker] 병목 가설 구조화 중...","#4FC3F7");
    const r1=await rBS(question);
    setResult("structuring",Object.assign({},r1,{gateResult:r1.status==="done"&&r1.quality&&r1.quality.hasHypothesis&&r1.quality&&r1.quality.hasContext?"pass":"block"}));
    if(r1.status!=="done"){addLog("✗ 실패: "+r1.error,"#EF5350");setCurrentStage(null);setStatus("error");return;}
    if(!r1.quality.hasHypothesis||!r1.quality.hasContext){addLog("⛔ G1: 병목 가설 또는 target_context 누락","#EF9F27");blockStagesFrom("search_strategy","G1","병목 가설 또는 population/setting/outcome이 생성되지 않았습니다.");setCurrentStage(null);setStatus("error");return;}
    addLog("✓ 완료 — 쿼리 "+r1.quality.queryCount+"개 | G1 PASS","#4CAF50");
    if(abortRef.current) return;

    // Worker 2
    setCurrentStage("search_strategy");setStatus("search_strategy");
    addLog("◉ [🎯 searchStrategyWorker] 검색 전략 생성 중...","#7986CB");
    const r2=await rSS(r1.parsed.bottleneck_hypothesis,r1.parsed.target_context,r1.parsed.concept_groups,r1.parsed.user_original_question,r1.parsed.domain_anchor_terms,r1.parsed.must_preserve_terms);
    setResult("search_strategy",Object.assign({},r2,{gateResult:r2.status==="done"&&r2.quality&&r2.quality.queryCount>=4?"pass":"block"}));
    if(r2.status!=="done"){addLog("✗ 실패: "+r2.error,"#EF5350");setCurrentStage(null);setStatus("error");return;}
    if(r2.quality.queryCount<4){addLog("⛔ G2: 쿼리 "+r2.quality.queryCount+"개 < 4개","#EF9F27");blockStagesFrom("search","G2","검색 쿼리가 4개 미만입니다.");setCurrentStage(null);setStatus("insufficient_evidence");return;}
    addLog("✓ 완료 — 쿼리 "+r2.quality.queryCount+"개, 다양성: "+(r2.quality.hasDiverseQueries?"✓":"△")+" | G2 PASS","#4CAF50");
    if(abortRef.current) return;

    // Worker 3 + 3.5: runVerifiedSearchLoop (검색-검증 통합 루프)
    // G3는 hard block 없음 — 0편이어도 retry 진행. 실제 차단은 G3.5(passableCount)만.
    setCurrentStage("search");setStatus("search");
    addLog("◉ [🔍+🛡️ verifiedSearchLoop] 검색-검증 루프 시작 (최대 2회 재시도)...","#FFB74D");
    const r35=await rVSL(r2.parsed.search_queries, 5, 2);

    // search stage: 마지막 검색 결과 표시
    var lastSR=r35.lastSearchResult||{status:"done",parsed:{candidate_papers:r35.parsed.all_candidates||[]},quality:{rawCount:r35.quality.totalRawCount||0,uniqueCount:(r35.parsed.all_candidates||[]).length,failedCount:r35.quality.totalFailedCount||0,queryCoverage:0}};
    setResult("search",Object.assign({},lastSR,{
      gateResult:(lastSR.quality&&lastSR.quality.uniqueCount>=5)?"pass":"warn",
      loopAttempts:r35.quality.attemptCount,
    }));
    addLog("◉ 검색 완료 ("+r35.quality.attemptCount+"회 시도) — 총 raw "+r35.quality.totalRawCount+"편, unique "+r35.quality.totalUniqueCount+"편, 실패 "+r35.quality.totalFailedCount+"건","#FFB74D");
    if(abortRef.current) return;

    // verify stage: 검증 결과 표시
    setCurrentStage("verify");setStatus("verify");
    const g35=r35.quality.passableCount>=5?"pass":r35.quality.passableCount>=3?"warn":"block";
    setResult("verify",Object.assign({},r35,{gateResult:g35}));
    var retryMsg=r35.quality.retryCount>0?" (재시도 "+r35.quality.retryCount+"회)":"";
    addLog("✓ 검증 완료"+retryMsg+" — verified: "+r35.quality.verifiedCount+"편, needs_review: "+r35.quality.needsReviewCount+"편, rejected: "+r35.quality.rejectedCount+"편","#4DB6AC");
    if(r35.quality.passableCount<3){addLog("⛔ G3.5: passable "+r35.quality.passableCount+"편 < 3편 (재시도 후에도 부족)","#EF9F27");blockStagesFrom("normalize","G3.5","검증 통과 후보가 3편 미만입니다.");setCurrentStage(null);setStatus("insufficient_evidence");return;}
    addLog("✓ G3.5 PASS — passable "+r35.quality.passableCount+"편 normalizer로 전달","#4CAF50");
    if(abortRef.current) return;

    // Worker 3.6: runSourceMetadataExtractorWorker — LLM 없음, URL/DOI 기반
    setCurrentStage("metadata_extract");setStatus("metadata_extract");
    addLog("◉ [🧾 sourceMetadataExtractorWorker] URL/DOI 기반 출처 메타데이터 보강 중...","#26A69A");
    const r36=rSME(r35.parsed.verified_candidates);
    var readyishCount=r36.quality.readyCount+r36.quality.needsMetadataReviewCount;
    var g36=r36.quality.readyCount>=3?"pass":readyishCount>=5?"warn":"block";
    setResult("metadata_extract",Object.assign({},r36,{gateResult:g36}));
    addLog("✓ 완료 — ready "+r36.quality.readyCount+"편, needs_review "+r36.quality.needsMetadataReviewCount+"편, DOI 추출 "+r36.quality.doiExtractedCount+"편, PMID "+r36.quality.pmidExtractedCount+"편, PMCID "+r36.quality.pmcidExtractedCount+"편","#26A69A");
    if(g36==="block"){addLog("⛔ G3.6: 선별 가능 후보 "+readyishCount+"편 < 5편","#EF9F27");blockStagesFrom("normalize","G3.6","선별 가능한 메타데이터 후보가 5편 미만입니다.");setCurrentStage(null);setStatus("insufficient_evidence");return;}
    if(g36==="warn") addLog("⚠ G3.6 WARN — ready 부족, normalizer 계속 진행 (Selection Analyst에 메타데이터 확인 우선순위 요청)","#FFB74D");
    else addLog("✓ G3.6 PASS","#4CAF50");
    if(abortRef.current) return;

    // Worker 4
    setCurrentStage("normalize");setStatus("normalize");
    addLog("◉ [📄 metadataNormalizerWorker] 메타데이터 정규화 중...","#CE93D8");
    const r4=await rMN(r36.parsed.enriched_candidates);
    if(r4.note) addLog("  ↳ "+r4.note,"#546E7A");
    const q4=r4.quality;
    if(q4.abstractCoverageRatio<0.3){
      addLog("⛔ G4: 초록 커버리지 "+(q4.abstractCoverageRatio*100).toFixed(0)+"% < 30%","#EF9F27");
      setResult("normalize",Object.assign({},r4,{gateResult:"warn"}));
      setResult("filter",{status:"gate_blocked",gate:"G4",error:"초록 커버리지가 50% 미만입니다.",retryable:true});
      setResult("handoff",{status:"skipped",error:"G4 차단으로 건너뜀"});
      setCurrentStage(null);setStatus("done");addLog("◉ 완료 (G4 경고) — 필터/전달 보류","#FFB74D");return;
    }
    setResult("normalize",Object.assign({},r4,{gateResult:"pass"}));
    addLog("✓ 완료 — "+q4.totalCount+"편, 초록 "+(q4.abstractCoverageRatio*100).toFixed(0)+"%, DOI "+(q4.doiCoverageRatio*100).toFixed(0)+"% | G4 PASS","#4CAF50");
    if(abortRef.current) return;

    // Worker 5
    setCurrentStage("filter");setStatus("filter");
    addLog("◉ [⚖️ candidateFilterWorker] 품질 필터링 중...","#EF9F27");
    const r5=await rCF(r4.parsed.normalized_candidates,r1.parsed.bottleneck_hypothesis);
    if(r5.warning) addLog("  ↳ ⚠ "+r5.warning,"#FFB74D");
    const q5=r5.quality;
    setResult("filter",Object.assign({},r5,{gateResult:q5.filteredCount>=3?"pass":"warn"}));
    if(q5.filteredCount<3){addLog("⛔ G5: 통과 후보 "+q5.filteredCount+"편 < 3편","#EF9F27");setResult("handoff",{status:"gate_blocked",gate:"G5",error:"필터링 후 후보가 "+q5.filteredCount+"편으로 부족합니다.",retryable:true});setCurrentStage(null);setStatus("done");addLog("◉ 완료 (G5 경고) — 전달 패키지 보류","#FFB74D");return;}
    addLog("✓ 완료 — 통과 "+q5.filteredCount+"편, 제외 "+q5.excludedCount+"편, 평균 태그 "+q5.avgTagCount+" | G5 PASS","#4CAF50");
    if(abortRef.current) return;

    // Worker 6
    setCurrentStage("handoff");setStatus("handoff");
    addLog("◉ [📦 handoffPackageWorker] 전달 패키지 생성 중...","#80DEEA");
    const r6=await rHP(r1.parsed.bottleneck_hypothesis,r1.parsed.target_context,r5.parsed.filtered_candidates,r1.parsed.user_original_question,r1.parsed.domain_anchor_terms);
    setResult("handoff",Object.assign({},r6,{gateResult:r6.status==="done"?"pass":"block"}));
    if(r6.status!=="done") addLog("✗ 실패: "+r6.error,"#EF5350");
    else addLog("✓ 완료 — 후보 "+r6.quality.candidateCount+"편, 프롬프트: "+(r6.quality.hasPrompt?"✓":"✗"),"#4CAF50");
    setCurrentStage(null);setStatus("done");
    addLog("◉ 파이프라인 완료 — 논문 후보 패키지 생성 완료","#66BB6A");
  }

  const doneCount=Object.values(stageResults).filter(r=>r&&r.status==="done").length;
  const totalPapers=(stageResults.search&&stageResults.search.parsed&&stageResults.search.parsed.candidate_papers&&stageResults.search.parsed.candidate_papers.length)||0;
  return{question,setQuestion,status,stageResults,currentStage,log,started,runResearch,reset,doneCount,totalPapers};
}

// ── UI Components ─────────────────────────────────────────────────────────────
function GlowButton({onClick,disabled,children,color}){
  color=color||"#4FC3F7";
  return <button onClick={onClick} disabled={disabled} style={{background:disabled?"#1a2a35":"linear-gradient(135deg,"+color+"22,"+color+"44)",border:"1px solid "+(disabled?"#2a3a45":color),color:disabled?"#37474F":color,padding:"10px 24px",borderRadius:"4px",cursor:disabled?"not-allowed":"pointer",fontFamily:"'Courier New',monospace",fontSize:"13px",letterSpacing:"1px",transition:"all 0.3s",boxShadow:disabled?"none":"0 0 12px "+color+"33"}}>{children}</button>;
}
function QualityBadge({gateResult}){
  const color=gateResult==="pass"?"#4CAF50":gateResult==="warn"?"#FFB74D":gateResult==="block"?"#EF5350":"#546E7A";
  const icon=gateResult==="pass"?"✓":gateResult==="warn"?"⚠":gateResult==="block"?"✗":"";
  return <span style={{fontSize:"9px",padding:"1px 7px",borderRadius:"3px",background:color+"22",border:"1px solid "+color+"66",color,marginLeft:"6px"}}>{icon} GATE {(gateResult||"").toUpperCase()}</span>;
}
const TAG_CONFIG={has_abstract:{label:"초록 있음",color:"#4CAF50"},recent_5yr:{label:"최근 5년",color:"#4FC3F7"},hospital_ops_relevant:{label:"병원 운영 관련",color:"#CE93D8"},data_method_clear:{label:"방법론 명확",color:"#FFB74D"},metadata_ready:{label:"선별 준비 완료",color:"#4CAF50"},needs_metadata_review:{label:"메타데이터 검토 필요",color:"#FFB74D"},url_only:{label:"URL만 확인됨",color:"#EF9F27"},doi_found:{label:"DOI 확인됨",color:"#80DEEA"},pmid_found:{label:"PMID 확인됨",color:"#7986CB"},pmcid_found:{label:"PMCID 확인됨",color:"#CE93D8"},title_inferred:{label:"제목 추정됨",color:"#EF5350"}};
function ScreeningTag({tag}){const cfg=TAG_CONFIG[tag]||{label:tag,color:"#546E7A"};return <span style={{fontSize:"9px",padding:"2px 6px",borderRadius:"10px",background:cfg.color+"22",border:"1px solid "+cfg.color+"55",color:cfg.color}}>{cfg.label}</span>;}
const STUDY_TYPE_COLOR={RCT:"#4CAF50",cohort:"#4FC3F7",systematic_review:"#7986CB",case_study:"#FFB74D",unknown:"#546E7A"};
const DATA_TYPE_COLOR={EHR:"#CE93D8",claims:"#80DEEA",survey:"#FFB74D",mixed:"#EF9F27",unknown:"#546E7A"};
function TypeBadge({value,colorMap}){const color=colorMap[value]||"#546E7A";return <span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"3px",background:color+"22",border:"1px solid "+color+"55",color}}>{value||"?"}</span>;}

function StageResultContent({stageId,result}){
  const[copied,setCopied]=useState(false);
  if(!result) return null;
  const{parsed,rawText,status}=result;
  if(status==="error") return <div style={{padding:"10px 12px",background:"#1a0808",border:"1px solid #EF535066",borderRadius:"4px",color:"#EF5350",fontSize:"11px"}}>✗ {result.error||"오류"}{result.retryable&&<span style={{color:"#FFB74D",marginLeft:"8px"}}>재시도 가능</span>}</div>;
  if(status==="insufficient_evidence") return <div style={{padding:"12px 14px",background:"#1a1400",border:"1px solid #FFB74D66",borderRadius:"4px",fontSize:"11px"}}><div style={{color:"#FFB74D",marginBottom:"6px",fontWeight:"bold"}}>⚠ 근거 부족</div><div style={{color:"#90A4AE"}}>{result.error}</div></div>;
  if(status==="skipped") return <div style={{padding:"10px 12px",background:"#0a1015",border:"1px solid #37474F",borderRadius:"4px",color:"#546E7A",fontSize:"11px",fontStyle:"italic"}}>○ {result.error||"건너뜀"}</div>;
  if(status==="gate_blocked") return <div style={{padding:"12px 14px",background:"#1a0e08",border:"1px solid #EF9F2766",borderRadius:"4px",fontSize:"11px"}}><div style={{color:"#EF9F27",marginBottom:"6px",fontWeight:"bold"}}>⚠ GATE 차단 — {result.gate}</div><div style={{color:"#90A4AE"}}>{result.error}</div></div>;
  if(!parsed) return <div style={{background:"#060e14",border:"1px solid #1a2a35",borderRadius:"4px",padding:"12px",fontFamily:"'Courier New',monospace",fontSize:"12px",color:"#90A4AE",whiteSpace:"pre-wrap",maxHeight:"200px",overflowY:"auto"}}>{rawText}</div>;

  const qPanel=result.quality?<div style={{marginBottom:"10px",padding:"6px 10px",background:"#080f16",borderRadius:"4px",border:"1px solid #1a2a35",display:"flex",gap:"8px",flexWrap:"wrap"}}>{Object.entries(result.quality).map(([k,v])=> <span key={k} style={{fontSize:"9px",color:"#546E7A"}}>{k}: <span style={{color:"#80DEEA"}}>{typeof v==="object"?JSON.stringify(v):String(v)}</span></span>)}</div>:null;

  if(stageId==="structuring") return <div style={{fontFamily:"'Courier New',monospace",fontSize:"12px"}}>
    {qPanel}
    <div style={{marginBottom:"12px",padding:"10px 12px",background:"#0a1520",borderRadius:"4px",borderLeft:"3px solid #4FC3F7"}}><div style={{color:"#37474F",fontSize:"10px",letterSpacing:"2px",marginBottom:"6px"}}>◈ 병목 가설</div><div style={{color:"#80DEEA",lineHeight:"1.7"}}>{parsed.bottleneck_hypothesis}</div></div>
    {parsed.target_context&&<div style={{marginBottom:"12px"}}><div style={{color:"#37474F",fontSize:"10px",letterSpacing:"2px",marginBottom:"8px"}}>◈ 연구 맥락</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"6px"}}>{[["Population",parsed.target_context.population],["Setting",parsed.target_context.setting],["Outcome",parsed.target_context.outcome]].map(item=> <div key={item[0]} style={{padding:"8px",background:"#080f16",borderRadius:"4px",border:"1px solid #1a2a35"}}><div style={{color:"#7986CB",fontSize:"9px",marginBottom:"4px"}}>{item[0]}</div><div style={{color:"#B0BEC5",fontSize:"10px",lineHeight:"1.5"}}>{item[1]}</div></div>)}</div></div>}
    {parsed.concept_groups&&<div style={{marginBottom:"12px"}}><div style={{color:"#37474F",fontSize:"10px",letterSpacing:"2px",marginBottom:"8px"}}>◈ 핵심 개념</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px"}}>{[["problem_terms","문제","#EF5350"],["operation_terms","운영","#4FC3F7"],["data_terms","데이터","#CE93D8"],["business_terms","비즈니스","#FFB74D"]].map(item=>{const terms=parsed.concept_groups[item[0]]||[];return terms.length?<div key={item[0]} style={{padding:"8px",background:"#080f16",borderRadius:"4px",border:"1px solid #1a2a35"}}><div style={{color:item[2],fontSize:"9px",marginBottom:"6px"}}>{item[1]}</div><div style={{display:"flex",flexWrap:"wrap",gap:"4px"}}>{terms.map((t,i)=> <span key={i} style={{fontSize:"10px",padding:"2px 8px",borderRadius:"10px",background:item[2]+"22",border:"1px solid "+item[2]+"44",color:item[2]}}>{t}</span>)}</div></div>:null;})}</div></div>}
    {parsed.search_queries&&parsed.search_queries.length>0&&<div><div style={{color:"#37474F",fontSize:"10px",letterSpacing:"2px",marginBottom:"6px"}}>◈ 초기 검색 쿼리</div><div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>{parsed.search_queries.map((q,i)=> <span key={i} style={{fontSize:"10px",padding:"2px 8px",borderRadius:"10px",background:"#0d2a3a",border:"1px solid #4FC3F744",color:"#4FC3F7"}}>🔍 {q}</span>)}</div></div>}
  </div>;

  if(stageId==="search_strategy") return <div style={{fontFamily:"'Courier New',monospace",fontSize:"12px"}}>
    {qPanel}
    <div style={{marginBottom:"12px"}}><div style={{color:"#37474F",fontSize:"10px",letterSpacing:"2px",marginBottom:"8px"}}>◈ 검색 쿼리 ({(parsed.search_queries||[]).length}개)</div>
    {(parsed.search_queries||[]).map((q,i)=>{const pc=q.source_preference==="paper"?"#4CAF50":q.source_preference==="guideline"?"#7986CB":"#FFB74D";return <div key={i} style={{padding:"8px 10px",background:"#080f16",borderRadius:"4px",border:"1px solid #1a2a35",marginBottom:"4px",display:"flex",gap:"10px",alignItems:"flex-start"}}><span style={{color:"#7986CB",flexShrink:0,fontSize:"11px"}}>{i+1}.</span><div style={{flex:1}}><div style={{color:"#B0BEC5",fontSize:"11px",marginBottom:"4px"}}>🔍 {q.query}</div>{q.purpose&&<div style={{color:"#546E7A",fontSize:"10px",marginBottom:"4px"}}>목적: {q.purpose}</div>}<span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"3px",background:pc+"22",border:"1px solid "+pc+"55",color:pc}}>{q.source_preference}</span></div></div>;})}
    </div>
    {parsed.inclusion_criteria&&parsed.inclusion_criteria.length>0&&<div style={{marginBottom:"10px"}}><div style={{color:"#37474F",fontSize:"10px",letterSpacing:"2px",marginBottom:"6px"}}>◈ 포함 기준</div>{parsed.inclusion_criteria.map((c,i)=> <div key={i} style={{color:"#4CAF50",fontSize:"11px",padding:"3px 8px",borderLeft:"2px solid #4CAF5066",marginBottom:"3px"}}>✓ {c}</div>)}</div>}
    {parsed.exclusion_criteria&&parsed.exclusion_criteria.length>0&&<div><div style={{color:"#37474F",fontSize:"10px",letterSpacing:"2px",marginBottom:"6px"}}>◈ 제외 기준</div>{parsed.exclusion_criteria.map((c,i)=> <div key={i} style={{color:"#EF5350",fontSize:"11px",padding:"3px 8px",borderLeft:"2px solid #EF535066",marginBottom:"3px"}}>✗ {c}</div>)}</div>}
  </div>;

  if(stageId==="search") return <div style={{fontFamily:"'Courier New',monospace",fontSize:"12px"}}>
    {qPanel}
    <div><div style={{color:"#37474F",fontSize:"10px",letterSpacing:"2px",marginBottom:"8px"}}>◈ 후보 논문 ({(parsed.candidate_papers||[]).length}편)</div>
    {(parsed.candidate_papers||[]).map((p,i)=> <div key={p.id||i} style={{marginBottom:"8px",padding:"8px 10px",background:"#080f16",borderRadius:"4px",border:"1px solid #1a2a35"}}>
      <div style={{display:"flex",gap:"8px",alignItems:"center",marginBottom:"4px",flexWrap:"wrap"}}>
        <span style={{color:"#7986CB",fontSize:"9px",flexShrink:0}}>{p.id}</span>
        <a href={p.url} target="_blank" rel="noopener noreferrer" style={{color:"#80DEEA",fontSize:"11px",textDecoration:"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"280px"}}>{p.title}</a>
        {p.year&&p.year!=="unknown"&&<span style={{color:"#546E7A",fontSize:"9px",flexShrink:0}}>{p.year}</span>}
        {p.journal&&<span style={{fontSize:"9px",padding:"1px 5px",borderRadius:"3px",background:"#1a2a35",color:"#546E7A"}}>{p.journal}</span>}
        <span style={{fontSize:"9px",padding:"1px 5px",borderRadius:"3px",background:"#1a2a35",color:"#546E7A"}}>{TYPE_LABEL[p.source_type]||"기타"}</span>
      </div>
      {p.snippet&&<div style={{color:"#546E7A",fontSize:"10px",lineHeight:"1.5"}}>{p.snippet}</div>}
    </div>)}
    </div>
    {parsed.failed_queries&&parsed.failed_queries.length>0&&<div style={{color:"#FFB74D",fontSize:"10px",marginTop:"8px"}}>⚠ 실패 쿼리: {parsed.failed_queries.join(", ")}</div>}
  </div>;

  if(stageId==="verify") {
    const vc=parsed.verified_candidates||[];
    const rc=parsed.rejected_candidates||[];
    const vStatusColor=(s)=>s==="verified"?"#4CAF50":s==="needs_review"?"#FFB74D":"#EF5350";
    return <div style={{fontFamily:"'Courier New',monospace",fontSize:"12px"}}>
      {qPanel}
      <div style={{marginBottom:"12px"}}><div style={{color:"#37474F",fontSize:"10px",letterSpacing:"2px",marginBottom:"8px"}}>◈ 통과 후보 — verified + needs_review ({vc.length}편)</div>
      {vc.map((c,i)=>{const v=c.verification||{};return <div key={c.id||i} style={{marginBottom:"8px",padding:"8px 10px",background:"#080f16",borderRadius:"4px",border:"1px solid "+vStatusColor(v.status)+"44"}}>
        <div style={{display:"flex",gap:"8px",alignItems:"center",marginBottom:"6px",flexWrap:"wrap"}}>
          <span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"3px",background:vStatusColor(v.status)+"22",border:"1px solid "+vStatusColor(v.status)+"66",color:vStatusColor(v.status)}}>{v.status||"unknown"}</span>
          <span style={{color:"#7986CB",fontSize:"9px",flexShrink:0}}>{c.id}</span>
          <a href={c.url} target="_blank" rel="noopener noreferrer" style={{color:"#80DEEA",fontSize:"11px",textDecoration:"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"240px"}}>{c.title}</a>
        </div>
        <div style={{display:"flex",gap:"10px",flexWrap:"wrap",fontSize:"9px",marginBottom:"4px"}}>
          <span style={{color:v.doi_format_valid?"#4CAF50":"#546E7A"}}>DOI형식: {v.doi_format_valid?"✓":"✗"}</span>
          <span style={{color:v.url_format_valid?"#4CAF50":"#546E7A"}}>URL형식: {v.url_format_valid?"✓":"✗"}</span>
          <span style={{color:v.url_placeholder_suspected?"#EF5350":"#546E7A"}}>placeholder: {v.url_placeholder_suspected?"의심":"없음"}</span>
          <span style={{color:"#80DEEA"}}>score: {v.confidence_score}</span>
        </div>
        {v.verification_notes&&v.verification_notes.length>0&&<div style={{color:"#546E7A",fontSize:"9px"}}>{v.verification_notes.join(" · ")}</div>}
      </div>;})}
      </div>
      {rc.length>0&&<div><div style={{color:"#37474F",fontSize:"10px",letterSpacing:"2px",marginBottom:"8px"}}>◈ rejected 후보 ({rc.length}편) — normalizer 이후로 전달 안 됨</div>
      {rc.map((c,i)=>{const v=c.verification||{};return <div key={c.id||i} style={{marginBottom:"6px",padding:"6px 10px",background:"#1a0808",borderRadius:"4px",border:"1px solid #EF535033"}}>
        <div style={{display:"flex",gap:"8px",alignItems:"center",marginBottom:"4px",flexWrap:"wrap"}}>
          <span style={{color:"#EF5350",fontSize:"9px",flexShrink:0}}>✗ rejected</span>
          <span style={{color:"#7986CB",fontSize:"9px",flexShrink:0}}>{c.id}</span>
          <span style={{color:"#546E7A",fontSize:"11px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"260px"}}>{c.title}</span>
        </div>
        {v.verification_notes&&<div style={{color:"#546E7A",fontSize:"9px"}}>{v.verification_notes.join(" · ")}</div>}
      </div>;})}
      </div>}
    </div>;
  }

  if(stageId==="metadata_extract") {
    const ec=parsed.enriched_candidates||[];
    const rdColor=(r)=>r==="ready"?"#4CAF50":r==="needs_metadata_review"?"#FFB74D":"#EF5350";
    const msColor=(s)=>s==="complete"?"#4CAF50":s==="partial"?"#80DEEA":s==="url_only"?"#FFB74D":"#EF5350";
    return <div style={{fontFamily:"'Courier New',monospace",fontSize:"12px"}}>
      {qPanel}
      <div style={{color:"#37474F",fontSize:"10px",letterSpacing:"2px",marginBottom:"8px"}}>◈ 보강된 후보 ({ec.length}편)</div>
      {ec.map(function(c,i){
        var rd=c.selection_readiness||"unknown";
        var ms=c.metadata_status||"unknown";
        var preview=c.abstract||c.snippet||"";
        return <div key={c.id||i} style={{marginBottom:"10px",padding:"8px 10px",background:"#080f16",borderRadius:"4px",border:"1px solid "+rdColor(rd)+"33"}}>
          <div style={{display:"flex",gap:"8px",alignItems:"center",marginBottom:"6px",flexWrap:"wrap"}}>
            <span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"3px",background:rdColor(rd)+"22",border:"1px solid "+rdColor(rd)+"66",color:rdColor(rd)}}>{rd}</span>
            <span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"3px",background:msColor(ms)+"22",border:"1px solid "+msColor(ms)+"66",color:msColor(ms)}}>{ms}</span>
            <span style={{color:"#7986CB",fontSize:"9px",flexShrink:0}}>{c.id}</span>
            <a href={c.url} target="_blank" rel="noopener noreferrer" style={{color:"#80DEEA",fontSize:"11px",textDecoration:"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"220px"}}>{c.title}</a>
            {c.title_inferred&&<span style={{fontSize:"9px",color:"#EF5350",flexShrink:0}}>추정제목</span>}
          </div>
          <div style={{display:"flex",gap:"10px",flexWrap:"wrap",fontSize:"9px",marginBottom:"4px"}}>
            {c.doi&&<span style={{color:"#80DEEA"}}>DOI: {c.doi.slice(0,30)}</span>}
            {c.pmid&&<span style={{color:"#7986CB"}}>PMID: {c.pmid}</span>}
            {c.pmcid&&<span style={{color:"#CE93D8"}}>PMCID: {c.pmcid}</span>}
            {c.source_family&&c.source_family!=="unknown"&&<span style={{color:"#4DB6AC"}}>source: {c.source_family}</span>}
          </div>
          {c.metadata_notes&&c.metadata_notes.length>0&&<div style={{color:"#546E7A",fontSize:"9px",marginBottom:"4px"}}>{c.metadata_notes.join(" · ")}</div>}
          {preview&&<div style={{color:"#37474F",fontSize:"10px",lineHeight:"1.5"}}>{preview.length>120?preview.slice(0,120)+"…":preview}</div>}
        </div>;
      })}
    </div>;
  }

  if(stageId==="normalize") return <div style={{fontFamily:"'Courier New',monospace",fontSize:"12px"}}>
    {qPanel}
    {parsed.missing_fields_summary&&<div style={{marginBottom:"12px",padding:"8px 10px",background:"#080f16",borderRadius:"4px",border:"1px solid #1a2a35"}}>
      <div style={{color:"#37474F",fontSize:"10px",letterSpacing:"2px",marginBottom:"6px"}}>◈ 누락 필드 요약</div>
      <div style={{display:"flex",gap:"12px",flexWrap:"wrap"}}>{Object.entries(parsed.missing_fields_summary).map(([k,v])=> <span key={k} style={{fontSize:"10px",color:v>0?"#FFB74D":"#4CAF50"}}>{k.replace("missing_","")}: {v}편 누락</span>)}</div>
    </div>}
    <div style={{color:"#37474F",fontSize:"10px",letterSpacing:"2px",marginBottom:"8px"}}>◈ 정규화된 논문 ({(parsed.normalized_candidates||[]).length}편)</div>
    {(parsed.normalized_candidates||[]).map((c,i)=> <div key={c.id||i} style={{marginBottom:"8px",padding:"8px 10px",background:"#080f16",borderRadius:"4px",border:"1px solid #1a2a35"}}>
      <div style={{display:"flex",gap:"8px",alignItems:"center",marginBottom:"6px",flexWrap:"wrap"}}>
        <span style={{color:"#7986CB",fontSize:"9px",flexShrink:0}}>{c.id}</span>
        <a href={c.url} target="_blank" rel="noopener noreferrer" style={{color:"#80DEEA",fontSize:"11px",textDecoration:"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"250px"}}>{c.title}</a>
        {c.year&&c.year!=="unknown"&&<span style={{color:"#546E7A",fontSize:"9px"}}>{c.year}</span>}
        <TypeBadge value={c.study_type} colorMap={STUDY_TYPE_COLOR}/>
        <TypeBadge value={c.data_type}  colorMap={DATA_TYPE_COLOR}/>
        {c.doi&&<span style={{fontSize:"9px",color:"#546E7A"}}>DOI ✓</span>}
      </div>
      {c.abstract&&<div style={{color:"#546E7A",fontSize:"10px",lineHeight:"1.5",marginBottom:"4px"}}>{c.abstract.length>180?c.abstract.slice(0,180)+"…":c.abstract}</div>}
      {c.relevance_note&&<div style={{color:"#7986CB",fontSize:"10px",fontStyle:"italic"}}>↳ {c.relevance_note}</div>}
    </div>)}
  </div>;

  if(stageId==="filter") return <div style={{fontFamily:"'Courier New',monospace",fontSize:"12px"}}>
    {qPanel}
    <div style={{marginBottom:"12px"}}><div style={{color:"#37474F",fontSize:"10px",letterSpacing:"2px",marginBottom:"8px"}}>◈ 통과 후보 ({(parsed.filtered_candidates||[]).length}편)</div>
    {(parsed.filtered_candidates||[]).map((c,i)=> <div key={c.id||i} style={{marginBottom:"8px",padding:"8px 10px",background:"#080f16",borderRadius:"4px",border:"1px solid #1a2a35"}}>
      <div style={{display:"flex",gap:"8px",alignItems:"center",marginBottom:"6px",flexWrap:"wrap"}}>
        <span style={{color:"#4CAF50",fontSize:"9px",flexShrink:0}}>{c.id}</span>
        <a href={c.url} target="_blank" rel="noopener noreferrer" style={{color:"#80DEEA",fontSize:"11px",textDecoration:"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"220px"}}>{c.title}</a>
        {c.year&&c.year!=="unknown"&&<span style={{color:"#546E7A",fontSize:"9px"}}>{c.year}</span>}
        <TypeBadge value={c.study_type} colorMap={STUDY_TYPE_COLOR}/>
      </div>
      <div style={{display:"flex",gap:"4px",flexWrap:"wrap"}}>{(c.screening_tags||[]).map((tag,j)=> <ScreeningTag key={j} tag={tag}/>)}{!(c.screening_tags||[]).length&&<span style={{fontSize:"9px",color:"#37474F",fontStyle:"italic"}}>태그 없음</span>}</div>
    </div>)}
    </div>
    {parsed.excluded&&parsed.excluded.length>0&&<div><div style={{color:"#37474F",fontSize:"10px",letterSpacing:"2px",marginBottom:"6px"}}>◈ 제외 ({parsed.excluded.length}편)</div>{parsed.excluded.map((ex,i)=> <div key={i} style={{display:"flex",gap:"8px",fontSize:"10px",padding:"4px 8px",color:"#546E7A",borderLeft:"2px solid #EF535033",marginBottom:"3px"}}><span style={{color:"#EF5350",flexShrink:0}}>{ex.id}</span><span>{ex.reason}</span></div>)}</div>}
  </div>;

  if(stageId==="handoff") return <div style={{fontFamily:"'Courier New',monospace",fontSize:"12px"}}>
    {qPanel}
    {parsed.selection_goal&&<div style={{marginBottom:"12px",padding:"10px 12px",background:"#0a1520",borderRadius:"4px",borderLeft:"3px solid #80DEEA"}}><div style={{color:"#37474F",fontSize:"10px",letterSpacing:"2px",marginBottom:"6px"}}>◈ 선정 목표</div><div style={{color:"#80DEEA",lineHeight:"1.6"}}>{parsed.selection_goal}</div></div>}
    {parsed.candidate_papers&&parsed.candidate_papers.length>0&&<div style={{marginBottom:"12px"}}><div style={{color:"#37474F",fontSize:"10px",letterSpacing:"2px",marginBottom:"8px"}}>◈ 전달 후보 ({parsed.candidate_papers.length}편)</div>{parsed.candidate_papers.map((p,i)=> <div key={p.id||i} style={{display:"flex",gap:"8px",alignItems:"center",padding:"5px 8px",background:"#080f16",borderRadius:"4px",marginBottom:"4px",flexWrap:"wrap"}}><span style={{color:"#80DEEA",fontSize:"9px",flexShrink:0}}>{p.id||(i+1)}</span><span style={{color:"#B0BEC5",fontSize:"11px",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.title}</span>{p.year&&p.year!=="unknown"&&<span style={{color:"#546E7A",fontSize:"9px",flexShrink:0}}>{p.year}</span>}{p.doi&&<span style={{fontSize:"9px",color:"#7986CB",flexShrink:0}}>DOI</span>}</div>)}</div>}
    {parsed.suggested_evaluation_rubric&&<div style={{marginBottom:"12px"}}><div style={{color:"#37474F",fontSize:"10px",letterSpacing:"2px",marginBottom:"8px"}}>◈ 평가 기준 (Rubric)</div>{Object.entries(parsed.suggested_evaluation_rubric).map(([k,v])=> <div key={k} style={{display:"flex",gap:"8px",padding:"5px 8px",background:"#080f16",borderRadius:"4px",marginBottom:"4px"}}><span style={{color:"#7986CB",fontSize:"9px",flexShrink:0,minWidth:"140px"}}>{k}</span><span style={{color:"#90A4AE",fontSize:"10px"}}>{v}</span></div>)}</div>}
    {parsed.known_limitations&&parsed.known_limitations.length>0&&<div style={{marginBottom:"12px"}}><div style={{color:"#37474F",fontSize:"10px",letterSpacing:"2px",marginBottom:"6px"}}>◈ 알려진 한계</div>{parsed.known_limitations.map((l,i)=> <div key={i} style={{color:"#FFB74D",fontSize:"11px",padding:"3px 8px",borderLeft:"2px solid #FFB74D66",marginBottom:"3px"}}>⚠ {l}</div>)}</div>}
    {parsed.selection_analyst_prompt&&<div style={{marginTop:"14px",borderTop:"1px solid #1a3a4a",paddingTop:"12px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"8px"}}>
        <div style={{color:"#37474F",fontSize:"10px",letterSpacing:"2px"}}>◈ Selection Analyst 프롬프트</div>
        <button onClick={()=>{navigator.clipboard.writeText(parsed.selection_analyst_prompt).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});}} style={{background:copied?"#0d2a1a":"#0d2a3a",border:"1px solid "+(copied?"#4CAF5066":"#80DEEA66"),borderRadius:"4px",padding:"4px 12px",color:copied?"#4CAF50":"#80DEEA",fontSize:"10px",cursor:"pointer",fontFamily:"'Courier New',monospace",letterSpacing:"1px",transition:"all 0.3s"}}>{copied?"✓ 복사됨":"📋 Copy Prompt"}</button>
      </div>
      <div style={{background:"#060e14",border:"1px solid #1a3a4a",borderRadius:"4px",padding:"10px 12px",color:"#546E7A",fontSize:"10px",lineHeight:"1.7",whiteSpace:"pre-wrap",maxHeight:"200px",overflowY:"auto"}}>{parsed.selection_analyst_prompt}</div>
    </div>}
  </div>;
  return null;
}

function StageCard({stage,result,isActive,isWaiting}){
  const isDone=result&&result.status==="done";
  const isErr=result&&result.status==="error";
  const isSpecial=result&&["insufficient_evidence","skipped","gate_blocked"].includes(result.status);
  const[open,setOpen]=useState(false);
  useEffect(()=>{if(isActive||isDone||isSpecial)setOpen(true);},[isActive,isDone,isSpecial]);
  const paperCount=isDone?((result.parsed&&result.parsed.candidate_papers&&result.parsed.candidate_papers.length)||(result.parsed&&result.parsed.normalized_candidates&&result.parsed.normalized_candidates.length)||(result.parsed&&result.parsed.filtered_candidates&&result.parsed.filtered_candidates.length)||0):0;
  const borderC=result&&result.status==="gate_blocked"?"#EF9F2766":result&&result.status==="insufficient_evidence"?"#FFB74D66":isErr?"#EF535066":isActive?stage.color:isDone?"#2a4a3a":"#1a2a35";
  const bgC=result&&result.status==="gate_blocked"?"#1a0e08":result&&result.status==="insufficient_evidence"?"#1a1200":isErr?"#1a0808":isActive?stage.color+"08":isDone?"#0d1f18":"#0a1520";
  return <div style={{border:"1px solid "+borderC,borderRadius:"6px",marginBottom:"8px",background:bgC,transition:"all 0.4s",boxShadow:isActive?"0 0 20px "+stage.color+"22":"none"}}>
    <div onClick={()=>{if(result||isActive||isSpecial)setOpen(o=>!o);}} style={{display:"flex",alignItems:"center",gap:"10px",padding:"12px 16px",cursor:(result||isActive||isSpecial)?"pointer":"default"}}>
      <span style={{fontSize:"18px"}}>{stage.emoji}</span>
      <div style={{flex:1}}>
        <div style={{fontFamily:"'Courier New',monospace",color:isSpecial?"#FFB74D":isErr?"#EF5350":isActive?stage.color:isDone?"#4CAF50":"#37474F",fontSize:"13px",fontWeight:"bold",letterSpacing:"1px"}}>{stage.label.toUpperCase()}</div>
        <div style={{color:"#2a3a45",fontSize:"9px",marginTop:"2px"}}>{stage.desc}</div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
        {isActive&&<span style={{color:stage.color,fontSize:"10px",animation:"pulse 1.2s infinite"}}>◉ PROCESSING</span>}
        {isErr&&<span style={{color:"#EF5350",fontSize:"10px"}}>✗ ERROR</span>}
        {result&&result.status==="gate_blocked"&&<span style={{color:"#EF9F27",fontSize:"10px"}}>⛔ GATE 차단</span>}
        {result&&result.status==="skipped"&&<span style={{color:"#546E7A",fontSize:"10px"}}>○ SKIPPED</span>}
        {isDone&&result.gateResult&&<QualityBadge gateResult={result.gateResult}/>}
        {isDone&&paperCount>0&&<span style={{color:"#4FC3F7",fontSize:"9px",background:"#0d2a3a",border:"1px solid #4FC3F766",borderRadius:"10px",padding:"1px 7px"}}>📄 {paperCount}편</span>}
        {isDone&&<span style={{color:"#4CAF50",fontSize:"10px"}}>✓</span>}
        {isWaiting&&!isSpecial&&<span style={{color:"#37474F",fontSize:"10px"}}>○</span>}
        {(result||isActive||isSpecial)&&<span style={{color:"#546E7A",fontSize:"10px"}}>{open?"▲":"▼"}</span>}
      </div>
    </div>
    {open&&(result||isActive||isSpecial)&&<div style={{padding:"0 16px 16px",borderTop:"1px solid "+stage.color+"22",marginTop:"4px"}}>{isActive&&!(result&&result.rawText)?<div style={{color:"#37474F",fontSize:"11px",animation:"pulse 1s infinite",padding:"12px"}}>처리 중...</div>:<StageResultContent stageId={stage.id} result={result}/>}</div>}
  </div>;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const WORKERS={runBottleneckStructuringWorker,runSearchStrategyWorker,runPaperSearchWorker,runCandidateExistenceVerifierWorker,runVerifiedSearchLoop,runSourceMetadataExtractorWorker,runCandidateMetadataNormalizerWorker,runCandidateFilterWorker,runHandoffPackageWorker};

export default function AIResearchManager(){
  const logRef=useRef(null);
  const{question,setQuestion,status,stageResults,currentStage,log,started,runResearch,reset,doneCount,totalPapers}=useResearchPipeline(WORKERS,STAGE_UI);
  useEffect(()=>{if(logRef.current)logRef.current.scrollTop=logRef.current.scrollHeight;},[log]);
  const si=STATUS_MAP[status]||STATUS_MAP.idle;

  return <div style={{minHeight:"100vh",background:"#060e14",fontFamily:"'Courier New', monospace",color:"#90A4AE"}}>
    <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0a1520}::-webkit-scrollbar-thumb{background:#1a3a4a;border-radius:2px}textarea:focus{outline:none}textarea{resize:none}a:hover{opacity:0.75}`}</style>

    <div style={{borderBottom:"1px solid #1a2a35",padding:"13px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#060e14",position:"sticky",top:0,zIndex:100}}>
      <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
        <div style={{width:"30px",height:"30px",borderRadius:"50%",background:"radial-gradient(circle,#7986CB,#1a237e)",boxShadow:"0 0 16px #7986CB66",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px"}}>🔬</div>
        <div>
          <div style={{color:"#7986CB",fontSize:"13px",letterSpacing:"3px",fontWeight:"bold"}}>PAPER RESEARCH PIPELINE</div>
          <div style={{color:"#37474F",fontSize:"9px",letterSpacing:"2px"}}>v3.1 · 8단계 · G1~G5+G3.6 · Source Metadata Extractor · Selection Readiness</div>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
        {totalPapers>0&&<div style={{padding:"3px 10px",border:"1px solid #7986CB66",borderRadius:"10px",color:"#7986CB",fontSize:"10px",background:"#1a1f40"}}>📄 {totalPapers}편 수집됨</div>}
        <div style={{padding:"4px 12px",border:"1px solid "+si.color,borderRadius:"3px",color:si.color,fontSize:"10px",letterSpacing:"2px",boxShadow:"0 0 8px "+si.color+"33",animation:status!=="idle"&&status!=="done"&&status!=="error"?"pulse 1.5s infinite":"none"}}>{si.label}</div>
      </div>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 290px",height:"calc(100vh - 57px)"}}>
      <div style={{padding:"20px 24px",overflowY:"auto",borderRight:"1px solid #1a2a35"}}>
        {!started&&<div style={{marginBottom:"24px"}}>
          <div style={{color:"#7986CB",fontSize:"10px",letterSpacing:"3px",marginBottom:"10px"}}>◈ BOTTLENECK HYPOTHESIS</div>
          <textarea value={question} onChange={e=>setQuestion(e.target.value)} placeholder="병목 가설을 입력하세요. 예: 응급실 체류 시간이 긴 환자군에서 퇴원 결정 지연의 원인은?" rows={3}
            style={{width:"100%",boxSizing:"border-box",background:"#0a1520",border:"1px solid #1a3a4a",borderRadius:"4px",color:"#B0BEC5",padding:"12px",fontFamily:"'Courier New',monospace",fontSize:"13px",lineHeight:"1.6",marginBottom:"10px"}}/>
          <div style={{marginBottom:"12px"}}>
            <div style={{color:"#2a3a45",fontSize:"9px",letterSpacing:"2px",marginBottom:"6px"}}>예시 가설</div>
            <div style={{display:"flex",flexDirection:"column",gap:"4px"}}>
              {EXAMPLES.map((ex,i)=> <button key={i} onClick={()=>setQuestion(ex)} style={{background:"#080f16",border:"1px solid #1a2a35",borderRadius:"3px",color:"#546E7A",fontSize:"10px",padding:"5px 10px",cursor:"pointer",textAlign:"left",fontFamily:"'Courier New',monospace"}} onMouseEnter={e=>e.target.style.borderColor="#7986CB66"} onMouseLeave={e=>e.target.style.borderColor="#1a2a35"}>▸ {ex}</button>)}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
            <GlowButton onClick={runResearch} disabled={!question.trim()} color="#7986CB">▶ INITIATE PAPER SEARCH</GlowButton>
            <span style={{color:"#2a3a45",fontSize:"10px"}}>8단계 · G1~G5+G3.6 · 전달 패키지 자동 생성</span>
          </div>
          <div style={{marginTop:"28px",borderTop:"1px solid #1a2a35",paddingTop:"20px"}}>
            <div style={{color:"#37474F",fontSize:"10px",letterSpacing:"2px",marginBottom:"14px"}}>◈ v1.0 파이프라인 구조</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
              {[["🧩 bottleneckStructuringWorker","병목 가설 → PICO 구조화 · G1"],["🎯 searchStrategyWorker","쿼리 4개+ + 포함/제외 기준 · G2"],["🔍 paperSearchWorker","4쿼리 병렬 · dedupe 목표 10편 · G3"],["📄 metadataNormalizerWorker","DOI·초록·study_type 보강 · G4"],["⚖️ candidateFilterWorker","screening_tags · 제외 목록 · G5"],["📦 handoffPackageWorker","후보 패키지 + 복사 가능 프롬프트"]].map((item,i)=> <div key={i} style={{border:"1px solid #1a2a35",borderRadius:"4px",padding:"8px 10px",background:"#0a1520"}}><div style={{color:"#7986CB",fontSize:"11px",marginBottom:"2px"}}>{item[0]}</div><div style={{color:"#37474F",fontSize:"10px"}}>{item[1]}</div></div>)}
            </div>
          </div>
        </div>}
        {started&&<div style={{background:"#0a1520",border:"1px solid #1a3a4a",borderRadius:"4px",padding:"10px 14px",marginBottom:"16px"}}><div style={{color:"#37474F",fontSize:"9px",letterSpacing:"2px",marginBottom:"3px"}}>ACTIVE BOTTLENECK HYPOTHESIS</div><div style={{color:"#80DEEA",fontSize:"12px"}}>"{question}"</div></div>}
        {started&&<div><div style={{color:"#7986CB",fontSize:"10px",letterSpacing:"3px",marginBottom:"14px"}}>◈ 8-STAGE PIPELINE — G1~G5+G3.6 다중 검증</div>{STAGE_UI.map(stage=> <StageCard key={stage.id} stage={stage} result={stageResults[stage.id]} isActive={currentStage===stage.id} isWaiting={!stageResults[stage.id]&&currentStage!==stage.id}/>)}</div>}
        {status==="done"&&<div style={{marginTop:"20px"}}><GlowButton onClick={reset} color="#66BB6A">◈ NEW RESEARCH SESSION</GlowButton></div>}
      </div>

      <div style={{display:"flex",flexDirection:"column",background:"#060e14"}}>
        <div style={{padding:"13px 16px 8px",borderBottom:"1px solid #1a2a35",color:"#7986CB",fontSize:"10px",letterSpacing:"3px"}}>◈ SYSTEM LOG</div>
        <div ref={logRef} style={{flex:1,overflowY:"auto",padding:"10px 14px",display:"flex",flexDirection:"column",gap:"4px"}}>
          {log.length===0&&<div style={{color:"#1a2a35",fontSize:"11px",textAlign:"center",marginTop:"40px"}}>시스템 대기 중...<br/>병목 가설을 입력하여 시작하세요.</div>}
          {log.map((entry,i)=> <div key={i} style={{display:"flex",gap:"8px",fontSize:"10px"}}><span style={{color:"#2a3a45",flexShrink:0}}>{entry.time}</span><span style={{color:entry.color,lineHeight:"1.5"}}>{entry.msg}</span></div>)}
          {status!=="idle"&&status!=="done"&&status!=="error"&&<div style={{color:"#37474F",fontSize:"11px",animation:"pulse 1s infinite"}}>▌</div>}
        </div>
        <div style={{padding:"12px 16px",borderTop:"1px solid #1a2a35"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:"5px"}}><span style={{color:"#37474F",fontSize:"9px",letterSpacing:"2px"}}>PROGRESS</span><span style={{color:"#546E7A",fontSize:"9px"}}>{doneCount}/{STAGE_UI.length}</span></div>
          <div style={{background:"#1a2a35",borderRadius:"2px",height:"3px",overflow:"hidden"}}><div style={{height:"100%",width:(doneCount/STAGE_UI.length*100)+"%",background:"linear-gradient(to right,#7986CB,#66BB6A)",transition:"width 0.6s ease",boxShadow:"0 0 8px #7986CB"}}/></div>
          {totalPapers>0&&<div style={{marginTop:"8px",padding:"6px 8px",background:"#0d1f2a",border:"1px solid #1a3a4a",borderRadius:"3px"}}><div style={{color:"#7986CB",fontSize:"10px"}}>📄 논문 <strong>{totalPapers}편</strong> 수집됨</div></div>}
          {status==="done"&&<button onClick={reset} style={{marginTop:"8px",width:"100%",padding:"6px",background:"#0d2a1a",border:"1px solid #4CAF5066",borderRadius:"3px",color:"#4CAF50",fontSize:"10px",cursor:"pointer",fontFamily:"'Courier New',monospace",letterSpacing:"1px"}}>◈ NEW SESSION</button>}
        </div>
      </div>
    </div>
  </div>;
}