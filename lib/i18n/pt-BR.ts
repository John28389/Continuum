/**
 * Every user-facing string.
 *
 * One locale, one typed map — an i18n framework would be machinery for a
 * problem this product does not have. Code, schema and comments stay in
 * English; everything the user reads is here.
 *
 * Tone: direct, calm, adult. The system explains and prompts reflection. It
 * does not scold, nag, or congratulate trivially. When a rule blocks something,
 * the text says what was blocked, which rule applies, why that rule exists, and
 * what the legitimate alternative is.
 */

import { RULES, type RuleCode } from "@/lib/rules/registry";

export interface RuleCopy {
  readonly name: string;
  readonly description: string;
  readonly rationale: string;
  readonly exceptions: string;
  /** Shown when this rule refuses an action. */
  readonly blocked: string;
}

const rules: Record<RuleCode, RuleCopy> = {
  "RULE-001": {
    name: "Uma missão principal por vez",
    description: "Apenas uma missão principal pode estar ativa simultaneamente.",
    rationale:
      "Abrir várias frentes ao mesmo tempo é exatamente o problema que este sistema existe para evitar. Trabalho em andamento é capacidade limitada, não preferência.",
    exceptions:
      "Nenhuma. Atividades pequenas de manutenção existem, mas não são missões e nunca têm a mesma autoridade visual.",
    blocked:
      "Já existe uma missão principal ativa. Conclua ou revise a missão atual antes de iniciar outra. Se a ideia nova é boa, estacione-a nas curiosidades: ela não se perde.",
  },
  "RULE-002": {
    name: "Definição de conclusão obrigatória",
    description: "Uma missão não pode ser ativada sem pelo menos um critério de conclusão.",
    rationale:
      "«Estudar web exploitation» não pode ser terminado, apenas abandonado. Sem um critério verificável não existe um fim honesto, e você nunca saberá que acabou.",
    exceptions:
      "A qualidade da redação do critério é apenas orientativa. O sistema sinaliza um critério vago, mas não bloqueia por isso.",
    blocked:
      "Esta missão ainda não tem critério de conclusão. Descreva ao menos um resultado observável antes de ativá-la.",
  },
  "RULE-003": {
    name: "Carga mínima e carga-alvo",
    description: "Toda missão tem carga mínima e carga-alvo, com alvo maior ou igual ao mínimo.",
    rationale:
      "O mínimo é propositalmente seguro: uma quantidade possível mesmo em um mês imperfeito. O alvo é a ambição. Manter os dois impede que o sistema trate «mais horas» como objetivo.",
    exceptions:
      "Ambos são variáveis e podem ser revisados. Aumentar o alvo no meio do ciclo, por empolgação, exige revisão formal.",
    blocked:
      "A carga-alvo não pode ser menor que a carga mínima, e o mínimo precisa ser maior que zero.",
  },
  "RULE-004": {
    name: "Saída justificada",
    description: "Encerrar uma missão ativa exige uma justificativa categorizada e escrita.",
    rationale:
      "É a regra que separa a troca por impulso da mudança real de premissa. Perder a vontade, entediar-se ou encontrar algo mais interessante não bastam.",
    exceptions: "Nenhuma quanto ao mecanismo. As categorias de motivo podem ser ampliadas.",
    blocked:
      "Para encerrar uma missão ativa, registre uma revisão com categoria e justificativa. Você está mudando a regra ou tentando escapar dela?",
  },
  "RULE-005": {
    name: "Ativação dentro do ciclo",
    description: "Uma missão só pode ser ativada dentro do ciclo atualmente ativo.",
    rationale:
      "Escolher a missão do próximo mês durante o mês atual é como a missão atual começa a ser abandonada mentalmente antes de terminar.",
    exceptions:
      "Planejamento preliminar é permitido e esperado. Ele apenas não resulta em uma missão ativa.",
    blocked:
      "Esta missão pertence a outro ciclo. Candidatas podem ser preparadas, mas a seleção oficial acontece na virada do ciclo.",
  },
  "RULE-006": {
    name: "Conclusão é definitiva",
    description: "Uma missão concluída nunca pode ser reaberta.",
    rationale:
      "O histórico precisa ser confiável para que o registro de integridade signifique algo. Se a conclusão pode ser revogada, o histórico deixa de descrever o que aconteceu.",
    exceptions: "Nenhuma. Trabalho seguinte vira uma nova missão.",
    blocked:
      "Esta missão já foi encerrada e permanece assim. Crie uma nova missão para o trabalho seguinte.",
  },
  "RULE-007": {
    name: "Curiosidades ficam estacionadas",
    description:
      "Uma curiosidade só pode virar uma missão em rascunho, nunca uma missão ativa, e só na virada do ciclo — antes da primeira missão do ciclo ser ativada.",
    rationale:
      "Ideias não podem se perder e também não podem virar prioridade no instante em que aparecem. O estacionamento guarda a ideia até a virada do ciclo.",
    exceptions: "Nenhuma quanto ao mecanismo.",
    blocked:
      "Curiosidades viram rascunho, nunca missão ativa, e só enquanto o ciclo atual ainda não tiver nenhuma missão ativada. Depois disso, ela aguarda o próximo ciclo.",
  },
  "RULE-008": {
    name: "Conclusão pelos critérios",
    description:
      "Uma missão só pode ser concluída a partir do estado ativo, com todos os critérios de conclusão satisfeitos.",
    rationale:
      "Quem decide que uma missão terminou é a definição de conclusão, não as horas. Se fosse possível concluir com critérios em aberto, a definição de conclusão viraria decoração e o registro deixaria de dizer se algo foi de fato terminado.",
    exceptions:
      "Nenhuma quanto ao mecanismo. Enquanto a missão está ativa, os critérios podem ser marcados e desmarcados livremente.",
    blocked:
      "Ainda há critérios de conclusão em aberto. Marque cada um como satisfeito quando o resultado existir; a conclusão fica disponível em seguida.",
  },
  "RULE-101": {
    name: "Critérios mensuráveis",
    description:
      "O sistema sinaliza critérios de conclusão sem resultado observável, mas não bloqueia.",
    rationale:
      "Julgar se um texto é mensurável é justamente o tipo de decisão que deve continuar sendo sua.",
    exceptions: "É apenas orientativa, sempre.",
    blocked: "Esta missão ainda não possui um critério de conclusão verificável.",
  },
  "RULE-102": {
    name: "Horas não são aprendizagem",
    description: "Atingir a carga-alvo nunca conclui uma missão.",
    rationale:
      "Tempo investido é métrica de entrada. A conclusão é determinada pelos critérios e pelas evidências.",
    exceptions: "Nenhuma.",
    blocked:
      "As horas foram atingidas, mas a missão não está concluída: os critérios de conclusão é que decidem.",
  },
  "RULE-103": {
    name: "Terminar cedo libera",
    description: "Quando a missão é concluída antes do fim do ciclo, você está liberado.",
    rationale:
      "O objetivo é consistência, não produtividade infinita. Criar trabalho artificial destruiria isso.",
    exceptions: "Nenhuma.",
    blocked: "",
  },
};

export const ptBR = {
  app: {
    name: "Continuum",
    tagline: "Sistema pessoal de execução.",
  },

  nav: {
    dashboard: "Painel",
    missions: "Missões",
    curiosities: "Curiosidades",
    knowledge: "Conhecimento",
    history: "Histórico",
    rules: "Regras",
    settings: "Ajustes",
  },

  shell: {
    skipToContent: "Ir para o conteúdo",
    primaryNavigation: "Navegação principal",
    openMenu: "Abrir menu",
    closeMenu: "Fechar menu",
  },

  /** Title and one-line purpose for each of the seven areas. */
  pages: {
    dashboard: {
      title: "Painel",
      description: "O que está em execução agora.",
    },
    missions: {
      title: "Missões",
      description: "A missão principal e o histórico de missões.",
    },
    curiosities: {
      title: "Curiosidades",
      description: "Ideias guardadas para avaliar na virada do ciclo.",
    },
    knowledge: {
      title: "Conhecimento",
      description: "Notas, descobertas e conexões que ficaram.",
    },
    history: {
      title: "Histórico",
      description: "Decisões registradas ao longo do tempo.",
    },
    rules: {
      title: "Regras",
      description: "O que o sistema garante, e por quê.",
    },
    settings: {
      title: "Ajustes",
      description: "Direção, campanhas e preferências.",
    },
  },

  hierarchy: {
    direction: {
      one: "Direção",
      many: "Direções",
      description: "O vetor de alguns meses. Muda raramente, e nunca só porque apareceu algo novo.",
      title: "Título",
      statement: "Descrição",
      create: "Criar direção",
      empty: "Nenhuma direção definida.",
    },
    campaign: {
      one: "Campanha",
      many: "Campanhas",
      description: "Um objetivo de cerca de três meses dentro de uma direção.",
      name: "Nome",
      objective: "Objetivo",
      descriptionField: "Descrição",
      successCriteria: "Critérios de sucesso",
      create: "Criar campanha",
      empty: "Nenhuma campanha criada.",
      needsDirection: "Crie uma direção antes de criar uma campanha.",
      belongsTo: "Direção",
    },
    cycle: {
      one: "Ciclo",
      many: "Ciclos",
      label: "Nome do ciclo",
      open: "Abrir ciclo",
      close: "Encerrar ciclo",
      none: "Nenhum ciclo aberto.",
      noneBody: "Abra um ciclo para começar a executar.",
      daysRemaining: "dias restantes",
      lastDay: "último dia",
      ended: "O ciclo terminou.",
      // Time elapsed, never achievement. Hours are an input metric and the
      // interface must not let a clock look like progress.
      elapsedLabel: "do tempo do ciclo decorrido",
      alreadyActive:
        "Já existe um ciclo aberto. Encerre o ciclo atual antes de abrir outro: um ciclo por vez é o que dá sentido à missão do ciclo.",
    },
    startsOn: "Início",
    endsOn: "Fim",
    status: "Situação",
    archive: "Arquivar",
    archived: "Arquivada",
    active: "Ativa",
    edit: "Editar",
    save: "Salvar",
    cancel: "Cancelar",
    manage: "Gerenciar",
  },

  /**
   * The dashboard's shortcuts. Starting a session lives in the mission panel
   * and parking a curiosity in the capture control on every screen, so only
   * the two that had no place yet are named here.
   */
  dashboard: {
    shortcuts: "Atalhos",
    recordDiscovery: "Registrar uma descoberta",
    openRules: "Ver as regras",
  },

  common: {
    loading: "Carregando…",
    nothingYet: "Nada aqui ainda.",
    notBuiltYet: "Esta área ainda será construída.",
    errorTitle: "Algo não funcionou",
    errorBody: "Nada foi alterado. Você pode tentar novamente.",
    retry: "Tentar novamente",
    notFoundTitle: "Página não encontrada",
    notFoundBody: "O endereço acessado não existe.",
    backToDashboard: "Voltar ao painel",
  },

  /** The four content classes. They must never read as equally urgent. */
  contentClass: {
    mission: "Missão",
    maintenance: "Manutenção",
    curiosity: "Curiosidade",
    leisure: "Lazer",
  },

  enforcement: {
    HARD: "Bloqueia",
    SOFT: "Exige confirmação",
    ADVISORY: "Apenas orienta",
  },

  severity: {
    critical: "Crítica",
    high: "Alta",
    medium: "Média",
    low: "Baixa",
  },

  missionStatus: {
    draft: "Rascunho",
    active: "Ativa",
    completed: "Concluída",
    revised: "Revisada",
    abandoned: "Encerrada",
  },

  reviewCategory: {
    premise_changed: "A premissa mudou",
    external_dependency: "Dependência externa inviabilizou",
    scope_error: "O escopo foi dimensionado errado",
    strategy_changed: "O objetivo estratégico mudou",
    evidence_obsolete: "Evidência mostrou que deixou de ser relevante",
  },

  curiosityState: {
    captured: "Capturada",
    waiting: "Aguardando",
    candidate: "Candidata",
    chosen: "Escolhida",
    archived: "Arquivada",
  },

  mission: {
    one: "Missão",
    many: "Missões",
    current: "Missão atual",
    completed: "MISSÃO CONCLUÍDA",
    /** Shown alongside the completion state. Finishing early is the system working. */
    completedFreedom:
      "O ciclo ainda não terminou, e não há mais nada a fazer aqui. Isso é o sistema funcionando.",
    minLoad: "Carga mínima",
    targetLoad: "Carga-alvo",
    definitionOfDone: "Definição de conclusão",
    evidence: "Evidências",
    nextAction: "Próxima ação",

    none: "Nenhuma missão criada ainda.",
    noneBody: "Toda missão nasce como rascunho. Ativar é um passo separado e deliberado.",
    noneActive: "Nenhuma missão ativa agora.",
    noneActiveBody: "Ative um rascunho quando decidir que é esta a missão do ciclo.",
    drafts: "Rascunhos",
    closed: "Encerradas",
    open: "Abrir",
    back: "Voltar às missões",

    create: "Criar missão",
    createTitle: "Nova missão",
    createDescription:
      "Ela nasce como rascunho. Descrever agora o que significa terminar é o que torna possível saber, depois, que acabou.",

    title: "Título",
    reason: "Por que esta missão",
    reasonHint:
      "É com isto que uma revisão futura vai se comparar. Sem motivo registrado, não há como distinguir mudança de premissa de troca por impulso.",
    descriptionField: "Descrição",
    campaign: "Campanha",
    cycle: "Ciclo",

    minLoadField: "Carga mínima (horas)",
    targetLoadField: "Carga-alvo (horas)",
    minLoadHint: "O que cabe em um mês imperfeito.",
    targetLoadHint: "O que você pretende, se o mês colaborar.",
    // RULE-102, said before the hours are even entered, so the form cannot be
    // read as "mais horas é melhor".
    loadNote:
      "Horas são métrica de entrada. Atingir a carga-alvo não conclui a missão: quem decide isso são os critérios de conclusão.",
    hoursShort: "h",

    criteria: "Critérios de conclusão",
    criteriaHint: "Um resultado observável: algo que outra pessoa conseguiria verificar.",
    criterion: "Critério",
    addCriterion: "Adicionar critério",
    removeCriterion: "Remover critério",
    criterionUnverifiable: "Sem resultado observável evidente.",

    activate: "Ativar missão",
    activating: "Ativando…",
    activatedAt: "Ativada em",
    createdAt: "Criada em",

    needsCampaign: "Crie uma campanha antes de criar uma missão.",
    needsCycle: "Abra um ciclo antes de criar uma missão.",
    parkInstead: "Estacionar a ideia nas curiosidades",

    of: "de",
    criteriaSatisfied: "critérios de conclusão satisfeitos",

    satisfy: "Marcar como satisfeito",
    unsatisfy: "Desmarcar",
    satisfied: "Satisfeito",
    openCriterion: "Em aberto",
    satisfyOnlyActive: "Critérios são marcados como satisfeitos apenas na missão ativa.",

    complete: "Concluir missão",
    completing: "Concluindo…",
    completionReady: "Todos os critérios estão satisfeitos. A missão pode ser concluída.",
    completionPending:
      "A conclusão fica disponível quando todos os critérios estiverem satisfeitos. Ainda em aberto:",
  },

  /**
   * Sessions: time, as an input.
   *
   * Everything here is written so that hours read as effort recorded, never as
   * progress made. The mission is finished by its criteria, and this copy says
   * so wherever hours appear.
   */
  session: {
    title: "Sessões",
    description:
      "Tempo investido nesta missão. Registra o esforço; quem decide a conclusão são os critérios.",
    view: "Sessões",
    start: "Iniciar sessão",
    starting: "Iniciando…",
    stop: "Encerrar sessão",
    stopping: "Encerrando…",
    running: "Sessão em andamento",
    since: "desde",
    note: "Nota (opcional)",
    discard: "Descartar sessão",
    discardHint:
      "Para um cronômetro esquecido: descarta a sessão em andamento sem registrar tempo.",

    logTitle: "Registrar uma sessão passada",
    logDescription: "Para um período trabalhado sem o cronômetro.",
    date: "Data",
    startTime: "Início",
    duration: "Duração (horas)",
    log: "Registrar sessão",
    manual: "registrada depois",
    minutesShort: "min",
    durationInvalid: "Informe a duração em horas, maior que zero e de no máximo 24.",
    startInvalid: "Informe a data e o horário de início.",

    none: "Nenhuma sessão registrada.",
    noneBody: "Sessões registram tempo, não resultado.",
    onlyActive: "Sessões são registradas apenas na missão ativa.",

    overlap: "Este período se sobrepõe a outra sessão já registrada. Ajuste o início ou a duração.",
    alreadyRunning: "Já há uma sessão em andamento. Encerre-a antes de iniciar outra.",
    inFuture: "Uma sessão registrada precisa já ter acontecido. Ajuste o início ou a duração.",
    missionNotActive:
      "Sessões registram trabalho na missão ativa, e esta missão não está ativa agora.",
    periodInvalid: "A sessão precisa ter duração maior que zero.",
  },

  /**
   * Load progress. Two thresholds, never a percentage.
   *
   * There is a distance to the minimum, because the floor is worth knowing
   * about. There is no distance to the target and no figure beyond it: a
   * countdown towards an ambition, or a surplus past it, would turn an input
   * metric into a score.
   */
  load: {
    title: "Horas registradas",
    inputMetric: "Métrica de entrada",
    logged: "Até agora",
    minimum: "Mínimo",
    target: "Alvo",
    remaining: "faltam",
    reached: "atingido",
  },

  /**
   * How a refusal is presented.
   *
   * A block is a prompt to think, so it gets the rule's name, the reason the
   * rule exists, and a legitimate way forward. A dead end with a red sentence
   * would be the same refusal with none of the value.
   */
  ruleBlock: {
    why: "Por que esta regra existe",
    alternative: "O que fazer em vez disso",
    advisory: "Observação",
    advisoryNote: "Isto não bloqueia nada. A avaliação continua sendo sua.",
  },

  /**
   * Evidence: what exists after the effort.
   *
   * Output, never input. The copy talks about artefacts and results and never
   * about time spent, because this section is the other side of the ledger from
   * hours.
   */
  evidence: {
    title: "Evidências",
    description:
      "O que existe depois do esforço: um artefato ou resultado que outra pessoa poderia verificar.",
    view: "Evidências",
    what: "O que foi produzido",
    url: "Link (opcional)",
    urlHint: "Repositório, writeup, relatório — onde a evidência pode ser vista.",
    criterion: "Critério atendido (opcional)",
    noCriterion: "Nenhum critério específico",
    add: "Registrar evidência",
    adding: "Registrando…",
    none: "Nenhuma evidência registrada.",
    noneBody: "Evidência é resultado, não esforço.",
    linked: "Evidência",
    missionNotActive:
      "Evidências são registradas na missão ativa, e esta missão não está ativa agora.",
    urlInvalid: "O link precisa começar com http:// ou https://.",
    descriptionRequired: "Descreva o que foi produzido.",
    criterionOtherMission: "Este critério pertence a outra missão.",
  },

  /**
   * The Rules page: what the system guarantees, read from the database itself.
   *
   * It says plainly which rules the database enforces and which only advise,
   * because a page that blurred the two would promise protection it cannot give.
   */
  rulesPage: {
    intro:
      "As regras que bloqueiam são aplicadas pelo próprio banco de dados: nenhuma tela, atalho ou agente consegue contorná-las. As que orientam apenas sinalizam, e a decisão continua sendo sua.",
    sections: {
      HARD: "Bloqueiam",
      SOFT: "Exigem confirmação",
      ADVISORY: "Orientam",
    },
    severity: "Severidade",
    exceptions: "Exceções",
    recentEvents: "Ocorrências recentes",
    noEvents: "Nenhuma ocorrência registrada.",
    none: "Nenhuma regra ativa encontrada.",
    noneBody:
      "Esta lista vem do banco de dados. Se está vazia, o banco não está aplicando nenhuma regra, e mostrar outra coisa seria falso.",
  },

  ruleEventOutcome: {
    blocked: "Bloqueou",
    overridden: "Liberada com confirmação",
    advised: "Orientou",
  },

  /**
   * Reviewing the active mission (RULE-004).
   *
   * A reflection, not a hurdle and never a reproach. The question is asked
   * once, plainly, and the legitimate way out is described in full — including
   * keeping the mission, which is a decision too.
   */
  review: {
    open: "Revisar esta missão",
    prompt: "Você está mudando a regra ou tentando escapar dela?",
    promptBody:
      "Uma revisão existe para mudanças reais: a premissa mudou, uma dependência externa caiu, o escopo foi mal dimensionado, a estratégia mudou, ou a evidência mostrou que a missão deixou de fazer sentido. Perder a vontade, entediar-se ou encontrar algo mais interessante não bastam — para isso existe o estacionamento de curiosidades.",
    outcome: "Decisão",
    outcomes: {
      kept: "Manter a missão",
      revised: "Revisar",
      abandoned: "Encerrar",
    },
    outcomeHints: {
      kept: "A revisão fica registrada e a missão continua ativa.",
      revised: "Esta missão se encerra como revisada. O trabalho reformulado vira uma nova missão.",
      abandoned: "A missão termina aqui, com o motivo registrado.",
    },
    category: "Categoria do motivo",
    categoryPlaceholder: "Escolha uma categoria",
    justification: "Justificativa",
    justificationHint: "O que mudou, e como você sabe. Pelo menos 20 caracteres.",
    submit: "Registrar revisão",
    submitting: "Registrando…",
    kept: "Revisão registrada. A missão continua.",
    outcomeRequired: "Escolha a decisão: manter, revisar ou encerrar.",
    categoryRequired: "Escolha a categoria do motivo.",
    justificationShort: "Escreva a justificativa com pelo menos 20 caracteres.",
  },

  /**
   * Knowledge: a light Zettelkasten.
   *
   * Nothing here asks for a note, reminds anyone to write one, or treats an
   * empty list as a problem. Notes are useful when they exist and absent
   * otherwise, and the copy says only that.
   */
  knowledge: {
    newNote: "Nova nota",
    newDescription: "Só o título e o conteúdo são obrigatórios.",
    create: "Criar nota",
    save: "Salvar",
    edit: "Editar",
    title: "Título",
    content: "Conteúdo",
    type: "Tipo",
    types: {
      discovery: "Descoberta",
      concept: "Conceito",
      evidence: "Evidência",
      connection: "Conexão",
      error: "Erro",
      generalisation: "Generalização",
    },
    searchLabel: "Buscar em título e conteúdo",
    allTypes: "Todos os tipos",
    search: "Buscar",
    none: "Nenhuma nota ainda.",
    noneBody: "Notas são opcionais. Nada no sistema depende de você escrever uma.",
    noMatch: "Nenhuma nota encontrada para essa busca.",
    origin: "Origem",
    fromMission: "Criar nota a partir desta missão",
    missionNotes: "Notas desta missão",
    links: "Ligações",
    linksEmpty: "Esta nota ainda não se liga a nenhuma outra.",
    backlinks: "Referenciada por",
    backlinksEmpty: "Nenhuma nota aponta para esta.",
    relation: "Relação",
    relations: {
      relates_to: "Relaciona-se com",
      supports: "Sustenta",
      contradicts: "Contradiz",
      extends: "Estende",
      derived_from: "Deriva de",
    },
    linkTo: "Ligar a",
    chooseNote: "Escolha uma nota",
    addLink: "Ligar",
    remove: "Remover",
    removeLink: "Remover ligação",
    noOtherNotes: "Crie outra nota para poder ligá-las.",
    back: "Voltar ao conhecimento",
    titleRequired: "Dê um título à nota.",
    contentRequired: "Escreva o conteúdo da nota.",
    selfLink: "Uma nota não pode ser ligada a si mesma.",
    duplicateLink: "Essa ligação já existe.",
  },

  /**
   * The curiosity parking lot.
   *
   * Capture is a single field on purpose: anything more would cost more than
   * the few seconds capture is supposed to take, and then it would stop
   * happening at the moment the idea appears. Nothing here nags — an idea sits
   * quietly until it is looked at, chosen, or let go.
   */
  curiosity: {
    captureLabel: "Nova curiosidade",
    titleField: "Título",
    capture: "Guardar",
    capturing: "Guardando…",
    captureShortcut: "Atalho: tecla C, em qualquer tela.",
    openCapture: "Guardar uma curiosidade",
    closeCapture: "Fechar",
    titleRequired: "Dê um título à curiosidade.",

    none: "Nenhuma curiosidade guardada ainda.",
    noneBody: "Guarde uma ideia em segundos. Ela fica fora da linha ativa até a virada do ciclo.",
    noMatch: "Nenhuma curiosidade neste estado.",

    filterLabel: "Estado",
    filterAll: "Todos os estados",
    filterApply: "Filtrar",
    dashboardCount: "curiosidades guardadas",

    setState: "Mudar estado",
    archive: "Arquivar",

    promote: "Promover a missão",
    promoteConfirm: "Confirmar promoção",
    promoteConfirming: "Confirmando…",
    promoteTitle: "Promover para missão em rascunho",
    promoteDescription:
      "Vira uma missão em rascunho, nunca ativa — e apenas enquanto o ciclo atual ainda não tiver nenhuma missão ativada.",
    campaign: "Campanha",
    reason: "Por que esta missão",
    minLoadField: "Carga mínima (horas)",
    targetLoadField: "Carga-alvo (horas)",
    needsCampaign: "Crie uma campanha antes de promover uma curiosidade.",
    promoted: "Promovida. O rascunho está em Missões.",
    viewMission: "Ver missão",
  },

  /**
   * History: the record, read back.
   *
   * Observations about what was recorded, never interpretation. Nothing here
   * characterises the person or names a pattern in their behaviour: the product
   * observes, it does not diagnose. A unit test scans this block for that
   * vocabulary.
   */
  history: {
    intro:
      "O que foi registrado, do mais recente ao mais antigo. O histórico é somente leitura: nada aqui pode ser alterado depois de acontecer.",
    sections: "Seções do histórico",
    tabs: {
      timeline: "Linha do tempo",
      cycles: "Ciclos",
      integrity: "Integridade",
    },

    filters: "Filtros do histórico",
    type: "Tipo",
    allTypes: "Todos os tipos",
    types: {
      mission: "Missões e revisões",
      curiosity: "Curiosidades",
      rule: "Regras",
      cycle: "Ciclos",
      campaign: "Campanhas",
      direction: "Direções",
    },
    from: "De",
    to: "Até",
    cycle: "Ciclo",
    allCycles: "Todos os ciclos",
    apply: "Filtrar",
    clear: "Limpar filtros",

    none: "Nada registrado ainda.",
    noneBody: "As decisões aparecem aqui à medida que acontecem.",
    noMatch: "Nenhum registro para estes filtros.",

    pagination: "Paginação do histórico",
    older: "Registros anteriores",
    newest: "Voltar aos mais recentes",

    removed: "Registro removido",
    decision: "Decisão",

    kinds: {
      mission: "Missão",
      review: "Revisão",
      curiosity: "Curiosidade",
      rule: "Regra",
      cycle: "Ciclo",
      campaign: "Campanha",
      direction: "Direção",
      other: "Registro",
    },

    events: {
      missionCreated: "Missão criada",
      missionActivated: "Missão ativada",
      missionCompleted: "Missão concluída",
      missionRevised: "Missão encerrada como revisada",
      missionAbandoned: "Missão encerrada",
      missionChanged: "Situação da missão alterada",
      reviewRecorded: "Revisão registrada",
      curiosityCaptured: "Curiosidade guardada",
      curiosityChanged: "Estado da curiosidade alterado",
      cyclePlanned: "Ciclo planejado",
      cycleOpened: "Ciclo aberto",
      cycleClosed: "Ciclo encerrado",
      cycleChanged: "Situação do ciclo alterada",
      campaignCreated: "Campanha criada",
      campaignChanged: "Situação da campanha alterada",
      directionCreated: "Direção criada",
      directionChanged: "Situação da direção alterada",
      other: "Registro do sistema",
    },

    /** What was being attempted when a rule held, from the server's own context. */
    attemptedActions: {
      "mission.create": "Criar missão",
      "mission.activate": "Ativar missão",
      "mission.complete": "Concluir missão",
      "mission.review": "Revisar missão",
      "criterion.satisfy": "Marcar critério",
      "evidence.add": "Registrar evidência",
      "curiosity.promote": "Promover curiosidade",
    },

    cycleStatus: {
      planned: "Planejado",
      active: "Em andamento",
      closed: "Encerrado",
    },
    campaignStatus: {
      planned: "Planejada",
      active: "Ativa",
      completed: "Concluída",
      archived: "Arquivada",
    },
    directionStatus: {
      active: "Ativa",
      archived: "Arquivada",
    },

    cycles: {
      none: "Nenhum ciclo ainda.",
      noneBody: "Cada ciclo aparece aqui com as missões que teve e como cada uma terminou.",
      noMissions: "Nenhuma missão neste ciclo.",
      viewTimeline: "Ver na linha do tempo",
    },
  },

  /**
   * Mission Integrity: counts and history, never a score.
   *
   * Every figure is a count of recorded facts and links to where it came from.
   * No ratio, no level, no streak, and nothing that characterises the person —
   * a unit test scans this block for that vocabulary.
   */
  integrity: {
    intro:
      "Contagens do que foi registrado. Cada número vem do histórico e pode ser conferido nele.",
    missions: "Missões",
    completed: "Concluídas",
    revised: "Revisadas",
    abandoned: "Encerradas",
    reviews: "Revisões",
    reviewsKept: "Revisões que mantiveram a missão",
    byCategory: "Revisões por motivo",
    noReviews: "Nenhuma revisão registrada.",
    rules: "Regras",
    blocked: "Vezes em que uma regra manteve um compromisso",
    blockedHint:
      "Recusas das regras que protegem a missão escolhida: uma missão por vez, saída justificada, ativação dentro do ciclo e curiosidades estacionadas.",
    viewMissions: "Ver missões e revisões na linha do tempo",
    viewRules: "Ver regras na linha do tempo",
    none: "Nada registrado ainda.",
    noneBody: "As contagens aparecem à medida que missões terminam e revisões são registradas.",
  },

  /**
   * The Trail of Evidence: the steps a mission has reached, and what each left
   * behind. Only reached steps are shown, so nothing here reads as missing.
   */
  trail: {
    title: "Trilha de evidências",
    steps: {
      created: "Missão criada",
      first_session: "Primeira sessão",
      first_discovery: "Primeira descoberta",
      first_evidence: "Primeira evidência",
      halfway: "Metade dos critérios satisfeita",
      definition_of_done: "Definição de conclusão atendida",
      completed: "Missão concluída",
    },
  },

  auth: {
    title: "Continuum",
    subtitle: "Sistema pessoal de execução.",
    email: "E-mail",
    password: "Senha",
    signIn: "Entrar",
    signingIn: "Entrando…",
    signOut: "Sair",
    // Deliberately does not say whether the address exists: that would let
    // anyone probe which accounts are registered.
    invalidCredentials: "E-mail ou senha incorretos.",
    emailRequired: "Informe seu e-mail.",
    emailInvalid: "E-mail inválido.",
    passwordRequired: "Informe sua senha.",
    signedInAs: "Conectado como",
  },

  errors: {
    notFound: "Registro não encontrado.",
    unexpected: "Algo não funcionou como esperado. Nada foi alterado.",
  },

  rules,
} as const;

export type Translations = typeof ptBR;

/** Copy for a rule. Typed so a new rule cannot ship without its text. */
export function ruleCopy(code: RuleCode): RuleCopy {
  return ptBR.rules[code];
}

/** Rules in display order, paired with their copy. */
export function rulesForDisplay() {
  return [...RULES]
    .sort((a, b) => a.position - b.position)
    .map((rule) => ({ ...rule, copy: ptBR.rules[rule.code] }));
}
