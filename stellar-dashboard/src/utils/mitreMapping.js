// MITRE ATT&CK Enterprise — technique library
// Reference: https://attack.mitre.org/matrices/enterprise/
//
// Primary use: ID-based lookup (getMitreById) against real technique IDs
// from the Stellar Cyber API (caseTactics.mitre.techniques).
//
// Legacy: correlateMitre() — regex pattern matching on free text — kept for
// backward compatibility but not used in the main recommendations flow.

const RULES = [
  {
    patterns: [/port.?scan/i, /nmap/i, /network.?scan/i, /host.?discovery/i, /service.?discovery/i, /port.?sweep/i, /tcp.?scan/i, /syn.?scan/i],
    technique: { id: 'T1046', name: 'Network Service Discovery' },
    tactic:    { id: 'TA0007', name: 'Discovery' },
    mitigation: {
      pt: 'Implemente segmentação de rede, monitore padrões de acesso sequencial a portas e bloqueie varreduras via IDS/IPS.',
      en: 'Implement network segmentation, monitor sequential port access patterns, and block scans via IDS/IPS.',
      es: 'Implemente segmentación de red, monitoree patrones de acceso secuencial a puertos y bloquee escaneos mediante IDS/IPS.',
    },
  },
  {
    patterns: [/brute.?force/i, /password.?spray/i, /credential.?stuff/i, /dictionary.?attack/i, /login.?attempt/i, /auth.?fail/i, /multiple.?fail/i],
    technique: { id: 'T1110', name: 'Brute Force' },
    tactic:    { id: 'TA0006', name: 'Credential Access' },
    mitigation: {
      pt: 'Habilite bloqueio de conta após falhas repetidas, implemente MFA em todos os serviços críticos e monitore picos de falhas de autenticação.',
      en: 'Enable account lockout after repeated failures, implement MFA on all critical services, and monitor spikes in authentication failures.',
      es: 'Habilite el bloqueo de cuentas tras fallos repetidos, implemente MFA en todos los servicios críticos y monitoree picos de fallos de autenticación.',
    },
  },
  {
    patterns: [/\bc2\b/i, /command.?and.?control/i, /beacon/i, /callback/i, /reverse.?shell/i, /\brat\b/i, /c&c/i, /remote.?access.?tool/i],
    technique: { id: 'T1071', name: 'Application Layer Protocol' },
    tactic:    { id: 'TA0011', name: 'Command and Control' },
    mitigation: {
      pt: 'Implemente inspeção de tráfego TLS, bloqueie IPs/domínios C2 via threat intelligence feeds e isole o host afetado imediatamente.',
      en: 'Implement TLS traffic inspection, block C2 IPs/domains via threat intelligence feeds, and immediately isolate the affected host.',
      es: 'Implemente inspección de tráfico TLS, bloquee IPs/dominios C2 mediante feeds de inteligencia de amenazas y aísle el host afectado de inmediato.',
    },
  },
  {
    patterns: [/lateral.?mov/i, /pass.?the.?hash/i, /pass.?the.?ticket/i, /\bpth\b/i, /wmi.?exec/i, /psexec/i, /remote.?exec/i, /smb.?lateral/i],
    technique: { id: 'T1021', name: 'Remote Services' },
    tactic:    { id: 'TA0008', name: 'Lateral Movement' },
    mitigation: {
      pt: 'Revise políticas de acesso remoto, aplique segmentação de rede, monitore autenticações incomuns entre hosts e implemente PAM.',
      en: 'Review remote access policies, apply network segmentation, monitor unusual host-to-host authentications, and implement PAM.',
      es: 'Revise las políticas de acceso remoto, aplique segmentación de red, monitoree autenticaciones inusuales entre hosts e implemente PAM.',
    },
  },
  {
    patterns: [/exfiltrat/i, /data.?theft/i, /data.?leak/i, /large.?outbound/i, /cloud.?storage.?upload/i, /data.?transfer/i, /unusual.?outbound/i],
    technique: { id: 'T1041', name: 'Exfiltration Over C2 Channel' },
    tactic:    { id: 'TA0010', name: 'Exfiltration' },
    mitigation: {
      pt: 'Implemente DLP, monitore e limite transferências volumosas, bloqueie destinos não autorizados e revise permissões de cloud storage.',
      en: 'Implement DLP, monitor and limit large transfers, block unauthorized destinations, and review cloud storage permissions.',
      es: 'Implemente DLP, monitoree y limite transferencias masivas, bloquee destinos no autorizados y revise los permisos de almacenamiento en la nube.',
    },
  },
  {
    patterns: [/ransomware/i, /file.?encrypt/i, /encrypt.?file/i, /wannacry/i, /lockbit/i, /ryuk/i, /conti/i, /blackcat/i, /cryptolocker/i],
    technique: { id: 'T1486', name: 'Data Encrypted for Impact' },
    tactic:    { id: 'TA0040', name: 'Impact' },
    mitigation: {
      pt: 'Isole o host imediatamente, acione a equipe de IR, não pague o resgate e inicie recuperação a partir de backups validados.',
      en: 'Immediately isolate the host, engage the IR team, do not pay the ransom, and begin recovery from validated backups.',
      es: 'Aísle el host de inmediato, active el equipo de IR, no pague el rescate e inicie la recuperación desde copias de seguridad validadas.',
    },
  },
  {
    patterns: [/powershell/i, /\.ps1\b/i, /invoke.?expression/i, /\biex\b/i, /encoded.?command/i, /bypass.?execution/i, /powershell.?down/i],
    technique: { id: 'T1059.001', name: 'Command and Scripting Interpreter: PowerShell' },
    tactic:    { id: 'TA0002', name: 'Execution' },
    mitigation: {
      pt: 'Habilite Script Block Logging, Module Logging e Transcription. Bloqueie execução não assinada via AppLocker/WDAC.',
      en: 'Enable Script Block Logging, Module Logging, and Transcription. Block unsigned execution via AppLocker/WDAC.',
      es: 'Habilite Script Block Logging, Module Logging y Transcription. Bloquee la ejecución no firmada mediante AppLocker/WDAC.',
    },
  },
  {
    patterns: [/credential.?dump/i, /mimikatz/i, /lsass/i, /hash.?dump/i, /sam.?dump/i, /ntlm.?hash/i, /credential.?harvest/i, /sekurlsa/i],
    technique: { id: 'T1003', name: 'OS Credential Dumping' },
    tactic:    { id: 'TA0006', name: 'Credential Access' },
    mitigation: {
      pt: 'Habilite Credential Guard, restrinja acesso ao LSASS, implemente MFA e monitore processos acessando credenciais do sistema.',
      en: 'Enable Credential Guard, restrict LSASS access, implement MFA, and monitor processes accessing system credentials.',
      es: 'Habilite Credential Guard, restrinja el acceso a LSASS, implemente MFA y monitoree procesos que acceden a las credenciales del sistema.',
    },
  },
  {
    patterns: [/dns.?tunnel/i, /dns.?exfil/i, /unusual.?dns/i, /dns.?spike/i, /dns.?covert/i, /dns.?c2/i, /outbound.?dns/i],
    technique: { id: 'T1071.004', name: 'Application Layer Protocol: DNS' },
    tactic:    { id: 'TA0011', name: 'Command and Control' },
    mitigation: {
      pt: 'Implemente DNS sinkhole, monitore queries DNS anômalas em volume/frequência e bloqueie resolvers externos não autorizados.',
      en: 'Implement DNS sinkhole, monitor anomalous DNS queries by volume/frequency, and block unauthorized external resolvers.',
      es: 'Implemente DNS sinkhole, monitoree consultas DNS anómalas por volumen/frecuencia y bloquee resolutores externos no autorizados.',
    },
  },
  {
    patterns: [/privilege.?escalat/i, /priv.?esc/i, /uac.?bypass/i, /sudo.?exploit/i, /kernel.?exploit/i, /elevation/i, /token.?impersonat/i],
    technique: { id: 'T1068', name: 'Exploitation for Privilege Escalation' },
    tactic:    { id: 'TA0004', name: 'Privilege Escalation' },
    mitigation: {
      pt: 'Aplique patches de segurança regularmente, implemente menor privilégio e monitore elevações de privilégio incomuns.',
      en: 'Apply security patches regularly, implement least privilege, and monitor unusual privilege escalations.',
      es: 'Aplique parches de seguridad regularmente, implemente mínimo privilegio y monitoree escaladas de privilegio inusuales.',
    },
  },
  {
    patterns: [/phishing/i, /spear.?phishing/i, /malicious.?email/i, /malicious.?attach/i, /malicious.?link/i, /phish/i, /vishing/i],
    technique: { id: 'T1566', name: 'Phishing' },
    tactic:    { id: 'TA0001', name: 'Initial Access' },
    mitigation: {
      pt: 'Habilite sandbox de email, treine usuários em reconhecimento de phishing e implemente DMARC/SPF/DKIM.',
      en: 'Enable email sandboxing, train users to recognize phishing, and implement DMARC/SPF/DKIM.',
      es: 'Habilite sandbox de correo electrónico, capacite a los usuarios para reconocer el phishing e implemente DMARC/SPF/DKIM.',
    },
  },
  {
    patterns: [/\bmalware\b/i, /\bvirus\b/i, /trojan/i, /backdoor/i, /rootkit/i, /spyware/i, /\bworm\b/i, /dropper/i, /loader\b/i],
    technique: { id: 'T1204', name: 'User Execution' },
    tactic:    { id: 'TA0002', name: 'Execution' },
    mitigation: {
      pt: 'Isole o endpoint, execute análise forense com EDR, limpe a infecção e reimplante o sistema se necessário.',
      en: 'Isolate the endpoint, conduct forensic analysis with EDR, remediate the infection, and reimage the system if necessary.',
      es: 'Aísle el endpoint, realice análisis forense con EDR, elimine la infección y reimagine el sistema si es necesario.',
    },
  },
  {
    patterns: [/insider.?threat/i, /privileged.?user/i, /privileged.?account/i, /abnormal.?admin/i, /unusual.?admin/i, /rogue.?admin/i],
    technique: { id: 'T1078', name: 'Valid Accounts' },
    tactic:    { id: 'TA0001', name: 'Initial Access' },
    mitigation: {
      pt: 'Implemente PAM, audite ações de contas privilegiadas regularmente e revise periodicamente os acessos concedidos.',
      en: 'Implement PAM, regularly audit privileged account actions, and periodically review granted access permissions.',
      es: 'Implemente PAM, audite regularmente las acciones de cuentas privilegiadas y revise periódicamente los accesos otorgados.',
    },
  },
  {
    patterns: [/vpn.?gateway/i, /vpn.?brute/i, /vpn.?auth/i, /remote.?access.?attack/i, /rdp.?attack/i, /rdp.?brute/i, /rdp.?scan/i],
    technique: { id: 'T1133', name: 'External Remote Services' },
    tactic:    { id: 'TA0001', name: 'Initial Access' },
    mitigation: {
      pt: 'Habilite MFA para VPN/RDP, monitore autenticações suspeitas e limite a exposição de serviços remotos.',
      en: 'Enable MFA for VPN/RDP, monitor suspicious authentications, and limit remote service exposure.',
      es: 'Habilite MFA para VPN/RDP, monitoree autenticaciones sospechosas y limite la exposición de servicios remotos.',
    },
  },
  {
    patterns: [/persistence/i, /registry.?run/i, /startup.?folder/i, /scheduled.?task/i, /cron.?job/i, /service.?install/i, /autorun/i],
    technique: { id: 'T1547', name: 'Boot or Logon Autostart Execution' },
    tactic:    { id: 'TA0003', name: 'Persistence' },
    mitigation: {
      pt: 'Monitore chaves de registro de autostart, tarefas agendadas suspeitas e novos serviços instalados.',
      en: 'Monitor autostart registry keys, suspicious scheduled tasks, and newly installed services.',
      es: 'Monitoree las claves de registro de inicio automático, tareas programadas sospechosas y nuevos servicios instalados.',
    },
  },
  {
    patterns: [/supply.?chain/i, /third.?party/i, /software.?supply/i, /vendor.?compromise/i, /dependency.?confus/i],
    technique: { id: 'T1195', name: 'Supply Chain Compromise' },
    tactic:    { id: 'TA0001', name: 'Initial Access' },
    mitigation: {
      pt: 'Valide integridade de software, implemente verificação de assinaturas e monitore comportamento de software de terceiros.',
      en: 'Validate software integrity, implement signature verification, and monitor third-party software behavior.',
      es: 'Valide la integridad del software, implemente verificación de firmas y monitoree el comportamiento del software de terceros.',
    },
  },
  {
    patterns: [/web.?shell/i, /webshell/i, /file.?upload.?exploit/i, /rce\b/i, /remote.?code.?exec/i, /sqli\b/i, /sql.?inject/i],
    technique: { id: 'T1190', name: 'Exploit Public-Facing Application' },
    tactic:    { id: 'TA0001', name: 'Initial Access' },
    mitigation: {
      pt: 'Aplique patches de segurança, implemente WAF, faça revisão de código e realize testes de penetração periódicos.',
      en: 'Apply security patches, implement WAF, conduct code reviews, and perform periodic penetration tests.',
      es: 'Aplique parches de seguridad, implemente WAF, realice revisiones de código y efectúe pruebas de penetración periódicas.',
    },
  },
]

// Build an ID-indexed map for O(1) lookup by technique ID
const RULES_BY_ID = new Map(RULES.map(r => [r.technique.id, r]))

/**
 * Returns the full rule for a given MITRE technique ID, or null if not found.
 * Example: getMitreById('T1046') → { technique, tactic, mitigation: { pt, en, es } }
 */
export function getMitreById(techId) {
  if (!techId) return null
  return RULES_BY_ID.get(techId) || null
}

/**
 * Returns the mitigation text for a technique ID in the requested locale.
 * Falls back to Portuguese if the locale is not found.
 * Returns null if the technique is not in the library.
 */
export function getMitreMitigation(techId, locale = 'pt') {
  const rule = getMitreById(techId)
  if (!rule) return null
  return rule.mitigation[locale] || rule.mitigation.pt
}

/**
 * Legacy: correlates free text (case name / description) with a MITRE technique
 * via regex pattern matching. Returns the first matching rule or null.
 * Not used in the main recommendations flow — kept for backward compatibility.
 */
export function correlateMitre(text) {
  if (!text) return null
  const input = String(text)
  for (const rule of RULES) {
    if (rule.patterns.some(p => p.test(input))) {
      return {
        technique:  rule.technique,
        tactic:     rule.tactic,
        risk:       rule.mitigation.pt,
        mitigation: rule.mitigation.pt,
      }
    }
  }
  return null
}

export { RULES as MITRE_RULES }
