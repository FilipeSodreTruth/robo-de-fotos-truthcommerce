# Comece aqui

Este é o atalho para mexer no layout de uma loja Nuvemshop com ajuda do agente.
Você não precisa saber programar. São três passos.

---

## Uma vez só, na sua máquina

Peça para alguém do time fazer isso com você na primeira vez. Depois nunca mais.

1. Instale o **Node.js** (versão 18 ou maior): https://nodejs.org
2. Instale o **Codex**, seguindo as instruções em https://developers.openai.com/codex
3. Baixe o script do seu sistema e deixe na área de trabalho:
   - Mac: `nova-loja.command`
   - Windows: `nova-loja.bat`
4. **Só no Mac**, duas coisas:

   Na primeira vez, o Mac vai bloquear o arquivo por ter vindo da internet. Clique nele com
   o **botão direito → Abrir → Abrir mesmo assim**. Depois disso o duplo clique funciona
   normalmente.

   E abra o Terminal uma vez e cole esta linha:

   ```
   chmod +x ~/Desktop/nova-loja.command
   ```

O script já vem com o endereço dos manuais configurado, e ajusta sozinho as permissões do
Codex na primeira execução. Você não precisa mexer em nada disso.

---

## Toda vez que for trabalhar numa loja

**1. Duplo clique no script.** `nova-loja.command` no Mac, `nova-loja.bat` no Windows.

**2. Digite o nome do cliente** e aperte Enter. Use sempre o mesmo nome para o mesmo
cliente — é assim que o agente reencontra o histórico do que já foi feito ali.

**3. Escreva o que você quer mudar**, em português normal, quando o Codex abrir.

> deixa os cards de produto da home com mais espaço entre eles

Pronto. O agente assume dali: pede o que precisar de você, testa a mudança ao vivo no
navegador, espera sua aprovação e só então publica.

---

## Sobre as permissões

O agente já vem configurado para trabalhar sozinho dentro da pasta daquele cliente: ele lê,
edita e testa sem ficar pedindo autorização a cada passo. Ele para e pergunta em dois
momentos, de propósito:

- antes de **publicar** a mudança na loja;
- se precisar fazer algo fora da pasta do cliente.

E existe um comando que ele simplesmente não consegue rodar, mesmo se tentar: o que troca a
versão do tema que está no ar. Isso é uma trava, não uma recomendação.

Se aparecer um pedido de autorização que você não entende, responda "não" e pergunte ao
agente por que ele precisa daquilo antes de liberar.

## O que esperar do agente

- **Ele vai pedir o endereço da loja e uma chave de acesso.** Ele explica onde buscar a
  chave. Você copia da tela e cola no chat.
- **Ele abre um navegador visível.** Isso é proposital: você acompanha as mudanças
  acontecendo. Não feche essa janela.
- **Ele mostra o resultado antes de publicar** e pergunta se pode subir. Enquanto você não
  responder, nada foi para a loja de verdade.
- **Ele pergunta antes de fechar o navegador** no fim.

## Se algo der errado

Diga em uma frase o que aconteceu — "a loja quebrou", "sumiu o menu", "ficou torto no
celular". O agente sabe voltar atrás sozinho e vai restaurar a loja antes de investigar.

Não digite comandos por conta própria e não feche a janela no meio de uma publicação.

## Perguntas comuns

**Preciso saber o que é essa chave que ele pede?**
Não. É uma permissão temporária para editar o tema. Não dá acesso a pedidos, clientes nem
pagamentos, e você pode invalidá-la depois gerando outra.

**Ele vai pedir minha senha da Nuvemshop?**
Nunca. Se pedir, algo está errado — pare e avise o time.

**Posso mexer em duas lojas ao mesmo tempo?**
Pode, mas em janelas separadas: um duplo clique no script para cada cliente.

**Deu erro logo no começo e nem abriu.**
Provavelmente falta o Node ou o Codex instalado, ou o endereço do repositório no script
está errado. Chame quem fez a instalação com você.
