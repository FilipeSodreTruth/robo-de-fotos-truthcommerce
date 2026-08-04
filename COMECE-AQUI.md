# Comece aqui

Você vai mexer no layout de lojas Nuvemshop com ajuda de um agente de IA. Não precisa saber
programar e não precisa entender de código.

São **duas partes**: uma instalação que você faz uma vez só, e o uso do dia a dia, que é
duplo clique.

---

# PARTE 1 — Instalação (uma vez na vida, ~15 minutos)

Peça para alguém do time fazer junto com você. Se travar em algum passo, pare e chame — não
tente adivinhar.

## Passo 1 de 3 — Instalar o Node

Abra https://nodejs.org e baixe a versão que o site sugerir. Instale como qualquer programa:
avançar, avançar, concluir.

Nada vai aparecer na tela depois. É normal — ele não tem ícone nem janela.

## Passo 2 de 3 — Instalar o Codex

Siga as instruções em https://developers.openai.com/codex

Você vai precisar entrar com uma conta. Se não tiver, peça ao time o acesso antes de
começar.

## Passo 3 de 3 — Pegar o atalho

Abra o **Terminal**:

- No Mac: aperte `Cmd + Espaço`, digite `Terminal`, Enter.
- No Windows: aperte a tecla Windows, digite `powershell`, Enter.

Vai abrir uma janela preta com texto. Não se assuste — você vai usar isso uma vez só.

**Copie a linha inteira** abaixo (a do seu sistema), cole na janela preta e aperte Enter.

No Mac:

```
curl -fsSL https://raw.githubusercontent.com/FilipeSodreTruth/robo-de-fotos-truthcommerce/main/nova-loja.command -o ~/Desktop/nova-loja.command && chmod +x ~/Desktop/nova-loja.command
```

No Windows (PowerShell):

```
curl.exe -fsSL https://raw.githubusercontent.com/FilipeSodreTruth/robo-de-fotos-truthcommerce/main/nova-loja.bat -o "$([Environment]::GetFolderPath('Desktop'))\nova-loja.bat"
```

Copie exatamente como está, incluindo o `.exe` — sem ele o PowerShell reclama de
"parâmetro 'fsSL'".

**Como saber se deu certo:** o Terminal não responde nada (é assim mesmo), e aparece um
arquivo chamado `nova-loja` na sua área de trabalho. Se ele não apareceu, algo falhou —
chame o time.

Pode fechar o Terminal. Acabou a instalação.

> **Por que colar uma linha em vez de baixar pelo navegador?** Porque arquivo baixado pelo
> navegador vem bloqueado pelo sistema, e você receberia um erro de "privilégios de acesso"
> ao tentar usar. A linha acima já traz o arquivo liberado.

---

# PARTE 2 — Uso do dia a dia

## 1. Duplo clique no `nova-loja` da área de trabalho

Abre uma janela preta perguntando o nome do cliente.

## 2. Digite o nome do cliente e Enter

Ex.: `mega-ar`. **Use sempre o mesmo nome para o mesmo cliente** — é assim que o agente
reencontra o histórico do que já foi feito naquela loja.

Você vai ver algo assim:

```
  Criando a pasta do cliente.
  Atualizando os manuais...
  Manuais atualizados.

  Pronto. Abrindo o Codex nesta pasta:
  /Users/voce/nuvemshop-lojas/mega-ar
```

## 3. Escolha o agente

Ele pergunta qual agente usar. Aperte **Enter** para o Codex (o padrão do time) ou digite
**c** e Enter para o Claude. Os dois seguem exatamente as mesmas regras.

## 4. O agente abre e fala primeiro

Ele vai se apresentar e pedir o que precisa de você. Você não precisa dar nenhum comando
especial nem mandar ele "ler" nada — ele já sabe o que fazer.

Se ele abrir calado esperando, escreva o que você quer:

> deixa os cards de produto da home com mais espaço entre eles

## 5. Responda o que ele pedir

Ele vai pedir o endereço da loja e uma chave de acesso, explicando onde buscar. Você copia
da tela e cola no chat.

## 6. Aprove antes de publicar

Ele abre um navegador, mostra a mudança acontecendo e pergunta se pode publicar. Enquanto
você não responder, **nada foi para a loja de verdade**.

---

# O que você NÃO precisa fazer

- ❌ Entrar no GitHub
- ❌ Baixar arquivos manualmente
- ❌ Criar pasta
- ❌ Abrir ou editar os arquivos `.md` que aparecem na pasta do cliente — são do agente
- ❌ Digitar comandos no Terminal (depois da instalação)
- ❌ Saber o que é `settings_data.json`, CSS ou tema

---

# Se algo der errado

**A loja quebrou / sumiu alguma coisa.** Diga isso ao agente em uma frase: "a loja quebrou",
"sumiu o menu". Ele sabe voltar atrás sozinho e restaura antes de investigar.

**O agente pede autorização para algo que você não entende.** Responda que não e pergunte a
ele por que precisa daquilo antes de liberar.

**Apareceu erro logo ao abrir.** Provavelmente falta o Node, ou o agente que você escolheu
não está instalado nessa máquina. Chame quem fez a
instalação com você.

**Ele pediu a senha da minha conta Nuvemshop.** Não forneça e avise o time. Ele nunca deve
pedir isso — só a senha da loja, que é outra coisa (a que aparece para o visitante quando a
loja está com acesso restrito).

Não digite comandos por conta própria e não feche a janela no meio de uma publicação.

---

# Perguntas comuns

**Que chave é essa que ele pede?**
Uma permissão temporária para editar o tema. Não dá acesso a pedidos, clientes nem
pagamentos, e pode ser invalidada depois gerando outra.

**Posso mexer em duas lojas ao mesmo tempo?**
Pode, em janelas separadas: um duplo clique para cada cliente.

**Preciso repetir a instalação em outro computador?**
Sim, a Parte 1 inteira. A Parte 2 é igual em qualquer máquina.

**Onde ficam as pastas dos clientes?**
Em `nuvemshop-lojas`, dentro da sua pasta de usuário. Você não precisa mexer nelas.
