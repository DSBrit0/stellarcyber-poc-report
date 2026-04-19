// MITRE ATT&CK Enterprise correlation engine
// Reference: https://attack.mitre.org/matrices/enterprise/
//
// Heuristic: pattern-match on case/event name and description text.
// First matching rule wins. When ambiguous, the more conservative (broader) tactic is preferred.

const RULES = [
  {
    patterns: [/port.?scan/i, /nmap/i, /network.?scan/i, /host.?discovery/i, /service.?discovery/i, /port.?sweep/i, /tcp.?scan/i, /syn.?scan/i],
    technique: { id: 'T1046', name: 'Network Service Discovery' },
    tactic:    { id: 'TA0007', name: 'Discovery' },
    risk:       'O adversário está mapeando serviços de rede para identificar superfície de ataque e vetores de exploração.',
    mitigation: 'Implemente segmentação de rede, monitore padrões de acesso sequencial a portas e bloqueie varreduras via IDS/IPS.',
  },
  {
    patterns: [/brute.?force/i, /password.?spray/i, /credential.?stuff/i, /dictionary.?attack/i, /login.?attempt/i, /auth.?fail/i, /multiple.?fail/i],
    technique: { id: 'T1110', name: 'Brute Force' },
    tactic:    { id: 'TA0006', name: 'Credential Access' },
    risk:       'Tentativas repetidas de autenticação indicam adversário tentando comprometer credenciais por força bruta.',
    mitigation: 'Habilite bloqueio de conta após falhas repetidas, implemente MFA em todos os serviços críticos e monitore picos de falhas de autenticação.',
  },
  {
    patterns: [/\bc2\b/i, /command.?and.?control/i, /beacon/i, /callback/i, /reverse.?shell/i, /\brat\b/i, /c&c/i, /remote.?access.?tool/i],
    technique: { id: 'T1071', name: 'Application Layer Protocol' },
    tactic:    { id: 'TA0011', name: 'Command and Control' },
    risk:       'Comunicação C2 indica host comprometido sendo controlado remotamente por um adversário.',
    mitigation: 'Implemente inspeção de tráfego TLS, bloqueie IPs/domínios C2 via threat intelligence feeds e isole o host afetado imediatamente.',
  },
  {
    patterns: [/lateral.?mov/i, /pass.?the.?hash/i, /pass.?the.?ticket/i, /\bpth\b/i, /wmi.?exec/i, /psexec/i, /remote.?exec/i, /smb.?lateral/i],
    technique: { id: 'T1021', name: 'Remote Services' },
    tactic:    { id: 'TA0008', name: 'Lateral Movement' },
    risk:       'O adversário está se movendo lateralmente pela rede para ampliar acesso a sistemas adicionais.',
    mitigation: 'Revise políticas de acesso remoto, aplique segmentação de rede, monitore autenticações incomuns entre hosts e implemente PAM.',
  },
  {
    patterns: [/exfiltrat/i, /data.?theft/i, /data.?leak/i, /large.?outbound/i, /cloud.?storage.?upload/i, /data.?transfer/i, /unusual.?outbound/i],
    technique: { id: 'T1041', name: 'Exfiltration Over C2 Channel' },
    tactic:    { id: 'TA0010', name: 'Exfiltration' },
    risk:       'Dados da organização estão sendo transferidos para infraestrutura não autorizada.',
    mitigation: 'Implemente DLP, monitore e limite transferências volumosas, bloqueie destinos não autorizados e revise permissões de cloud storage.',
  },
  {
    patterns: [/ransomware/i, /file.?encrypt/i, /encrypt.?file/i, /wannacry/i, /lockbit/i, /ryuk/i, /conti/i, /blackcat/i, /cryptolocker/i],
    technique: { id: 'T1486', name: 'Data Encrypted for Impact' },
    tactic:    { id: 'TA0040', name: 'Impact' },
    risk:       'Ransomware ou criptografia destrutiva detectada — pode resultar em perda total de acesso a dados críticos.',
    mitigation: 'Isole o host imediatamente, acione a equipe de IR, não pague o resgate e inicie recuperação a partir de backups validados.',
  },
  {
    patterns: [/powershell/i, /\.ps1\b/i, /invoke.?expression/i, /\biex\b/i, /encoded.?command/i, /bypass.?execution/i, /powershell.?down/i],
    technique: { id: 'T1059.001', name: 'Command and Scripting Interpreter: PowerShell' },
    tactic:    { id: 'TA0002', name: 'Execution' },
    risk:       'Execução suspeita de PowerShell pode indicar malware, exploração ou download de payload adicional.',
    mitigation: 'Habilite Script Block Logging, Module Logging e Transcription. Bloqueie execução não assinada via AppLocker/WDAC.',
  },
  {
    patterns: [/credential.?dump/i, /mimikatz/i, /lsass/i, /hash.?dump/i, /sam.?dump/i, /ntlm.?hash/i, /credential.?harvest/i, /sekurlsa/i],
    technique: { id: 'T1003', name: 'OS Credential Dumping' },
    tactic:    { id: 'TA0006', name: 'Credential Access' },
    risk:       'Extração de credenciais do sistema permite ao adversário autenticar-se como outros usuários e expandir o acesso.',
    mitigation: 'Habilite Credential Guard, restrinja acesso ao LSASS, implemente MFA e monitore processos acessando credenciais do sistema.',
  },
  {
    patterns: [/dns.?tunnel/i, /dns.?exfil/i, /unusual.?dns/i, /dns.?spike/i, /dns.?covert/i, /dns.?c2/i, /outbound.?dns/i],
    technique: { id: 'T1071.004', name: 'Application Layer Protocol: DNS' },
    tactic:    { id: 'TA0011', name: 'Command and Control' },
    risk:       'DNS sendo usado como canal encoberto para C2 ou exfiltração, frequentemente ignorado por firewalls tradicionais.',
    mitigation: 'Implemente DNS sinkhole, monitore queries DNS anômalas em volume/frequência e bloqueie resolvers externos não autorizados.',
  },
  {
    patterns: [/privilege.?escalat/i, /priv.?esc/i, /uac.?bypass/i, /sudo.?exploit/i, /kernel.?exploit/i, /elevation/i, /token.?impersonat/i],
    technique: { id: 'T1068', name: 'Exploitation for Privilege Escalation' },
    tactic:    { id: 'TA0004', name: 'Privilege Escalation' },
    risk:       'O adversário está tentando obter privilégios elevados para controle total do sistema comprometido.',
    mitigation: 'Aplique patches de segurança regularmente, implemente menor privilégio e monitore elevações de privilégio incomuns.',
  },
  {
    patterns: [/phishing/i, /spear.?phishing/i, /malicious.?email/i, /malicious.?attach/i, /malicious.?link/i, /phish/i, /vishing/i],
    technique: { id: 'T1566', name: 'Phishing' },
    tactic:    { id: 'TA0001', name: 'Initial Access' },
    risk:       'Phishing é o vetor de acesso inicial mais comum, podendo levar a comprometimento de credenciais e execução de malware.',
    mitigation: 'Habilite sandbox de email, treine usuários em reconhecimento de phishing e implemente DMARC/SPF/DKIM.',
  },
  {
    patterns: [/\bmalware\b/i, /\bvirus\b/i, /trojan/i, /backdoor/i, /rootkit/i, /spyware/i, /\bworm\b/i, /dropper/i, /loader\b/i],
    technique: { id: 'T1204', name: 'User Execution' },
    tactic:    { id: 'TA0002', name: 'Execution' },
    risk:       'Software malicioso detectado em execução ou armazenado no endpoint comprometido.',
    mitigation: 'Isole o endpoint, execute análise forense com EDR, limpe a infecção e reimplante o sistema se necessário.',
  },
  {
    patterns: [/insider.?threat/i, /privileged.?user/i, /privileged.?account/i, /abnormal.?admin/i, /unusual.?admin/i, /rogue.?admin/i],
    technique: { id: 'T1078', name: 'Valid Accounts' },
    tactic:    { id: 'TA0001', name: 'Initial Access' },
    risk:       'Uso anômalo de conta privilegiada pode indicar comprometimento de credenciais ou ameaça interna.',
    mitigation: 'Implemente PAM, audite ações de contas privilegiadas regularmente e revise periodicamente os acessos concedidos.',
  },
  {
    patterns: [/vpn.?gateway/i, /vpn.?brute/i, /vpn.?auth/i, /remote.?access.?attack/i, /rdp.?attack/i, /rdp.?brute/i, /rdp.?scan/i],
    technique: { id: 'T1133', name: 'External Remote Services' },
    tactic:    { id: 'TA0001', name: 'Initial Access' },
    risk:       'Ataques a serviços de acesso remoto (VPN/RDP) podem permitir acesso inicial não autorizado à rede interna.',
    mitigation: 'Habilite MFA para VPN/RDP, monitore autenticações suspeitas e limite a exposição de serviços remotos.',
  },
  {
    patterns: [/persistence/i, /registry.?run/i, /startup.?folder/i, /scheduled.?task/i, /cron.?job/i, /service.?install/i, /autorun/i],
    technique: { id: 'T1547', name: 'Boot or Logon Autostart Execution' },
    tactic:    { id: 'TA0003', name: 'Persistence' },
    risk:       'Mecanismos de persistência garantem que o malware sobreviva a reinicializações e remoções parciais.',
    mitigation: 'Monitore chaves de registro de autostart, tarefas agendadas suspeitas e novos serviços instalados.',
  },
  {
    patterns: [/supply.?chain/i, /third.?party/i, /software.?supply/i, /vendor.?compromise/i, /dependency.?confus/i],
    technique: { id: 'T1195', name: 'Supply Chain Compromise' },
    tactic:    { id: 'TA0001', name: 'Initial Access' },
    risk:       'Comprometimento via cadeia de suprimentos pode introduzir backdoors em software confiável.',
    mitigation: 'Valide integridade de software, implemente verificação de assinaturas e monitore comportamento de software de terceiros.',
  },
  {
    patterns: [/web.?shell/i, /webshell/i, /file.?upload.?exploit/i, /rce\b/i, /remote.?code.?exec/i, /sqli\b/i, /sql.?inject/i],
    technique: { id: 'T1190', name: 'Exploit Public-Facing Application' },
    tactic:    { id: 'TA0001', name: 'Initial Access' },
    risk:       'Exploração de aplicação pública pode fornecer acesso inicial ao ambiente interno.',
    mitigation: 'Aplique patches de segurança, implemente WAF, faça revisão de código e realize testes de penetração periódicos.',
  },
]

/**
 * Correlates text (case name or description) with a MITRE ATT&CK technique.
 * Returns the first matching rule or null if no match is found.
 */
export function correlateMitre(text) {
  if (!text) return null
  const input = String(text)
  for (const rule of RULES) {
    if (rule.patterns.some(p => p.test(input))) {
      return {
        technique:  rule.technique,
        tactic:     rule.tactic,
        risk:       rule.risk,
        mitigation: rule.mitigation,
      }
    }
  }
  return null
}

export { RULES as MITRE_RULES }
