# Integração de leads e implantação

O projeto funciona como site estático e usa um endpoint do Google Apps Script externo ao repositório.

1. Implante o Apps Script na conta que administra a planilha, executando como proprietário, e verifique se a aba `Leads` existe.
2. Copie `js/config.example.js` para `js/config.js` (arquivo ignorado pelo Git).
3. Preencha `leadEndpoint` com a URL `/exec`. **Não** inclua tokens, senhas, IDs privados de planilha ou e-mails pessoais.
4. Suba o site para sua hospedagem. Como `js/config.js` é ignorado, inclua esse arquivo apenas no artefato da implantação (sem comitá-lo).
5. Abra a página e cadastre um lead de teste com consentimento, confira a gravação na planilha e a liberação do PDF.

## Considerações de segurança

- Uma URL `/exec` utilizada no navegador **não é secreta**, mesmo quando não fica versionada no GitHub.
- A verificação por postMessage/ID da solicitação é uma confirmação funcional, **não uma autenticação criptográfica**.
- O honeypot e a validação do cliente podem ser contornados; o servidor deve validar os campos e aplicar proteção contra spam.
- Não use a URL do Apps Script como controle de autorização a documentos privados.
- O PDF fica em `assets/materiais/` e é **público** no repositório. O formulário condiciona o fluxo de interface, não protege o acesso ao arquivo. Para acesso restrito, use armazenamento privado e URLs assinadas por backend.
- Mantenha aviso de privacidade e política de retenção dos leads adequados à LGPD.

## Observações de publicação

No GitHub Pages, verifique o caminho relativo `assets/materiais/...` a partir de `index.html` e faça testes de responsividade. Se os arquivos forem incorporados no Systeme.io, os caminhos locais precisam ser convertidos em URLs públicas.
