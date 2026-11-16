# 🤖 Godot Gemini AI Assistant (Android PWA)

Uma mini interface moderna, rápida e responsiva para Android que se conecta diretamente ao seu projeto **Godot** e à API do **Google Gemini**.

Permite que o Gemini inspecione arquivos, crie e edite scripts GDScript e cenas diretamente na pasta do seu projeto pelo celular, além de suportar prompts de texto, envio de imagens (fotos da câmera ou capturas de tela) e inserção da sua chave de API.

---

## 🚀 Como Executar e Usar no Celular

### 1. Iniciar o Servidor no PC
Basta dar dois cliques no arquivo:
```bat
iniciar.bat
```
*(ou pelo terminal: `python server.py`)*

O terminal exibirá o endereço para conectar no celular, por exemplo:
```text
https://192.168.x.x:5443
```

---

### 2. Abrir no Celular Android
1. Certifique-se de que o celular está conectado na **mesma rede Wi-Fi** do computador.
2. No celular, abra o **Google Chrome** e acerte o endereço exibido (ex: `https://192.168.x.x:5443`).
3. Como usamos certificado SSL local seguro, o Chrome pode exibir uma tela de aviso:
   - Toque em **"Avançado"**
   - Depois toque em **"Continuar para https://192.168.x.x (não seguro)"**
4. **Instalar como Aplicativo**:
   - No Chrome, toque nos **3 pontinhos (⋮)** no canto superior direito.
   - Selecione **"Instalar aplicativo"** (ou "Adicionar à tela inicial").
   - O ícone do app aparecerá na gaveta de aplicativos e na tela inicial do seu Android, funcionando em tela cheia como um app nativo!

---

### 3. Configurar a Chave do Gemini
1. No app, toque no ícone de engrenagem **⚙️** (Configurações).
2. Cole sua chave de API do Gemini (obtida gratuitamente no [Google AI Studio](https://aistudio.google.com/app/apikey)).
3. Escolha o modelo desejado (o padrão é o **Gemini 2.5 Flash**, que é super rápido e ótimo com ferramentas).
4. Toque em **Salvar Configurações**. A chave fica guardada no seu próprio aparelho com total segurança.

---

### 4. Conectar a Pasta do Projeto Godot
1. Na barra superior do app, toque no botão **"📂 Abrir Pasta"**.
2. O seletor de arquivos do Android será aberto: selecione a pasta onde está o seu projeto Godot (onde fica o `project.godot`).
3. O Chrome pedirá permissão de leitura e gravação: confirme em **"Permitir"**.
4. Pronto! A luz indicadora ficará **verde** e o nome do seu projeto aparecerá no topo.

---

### 5. Recursos e Ferramentas Disponíveis

- **Prompt com Ferramentas do Gemini**:
  - *"Crie um script de movimentação 2D para Player.gd com aceleração e pulo"* -> O Gemini gera o código e grava o arquivo `Player.gd` na pasta do Godot.
  - *"Analise o arquivo Timer.gd e corrija o bug de contagem"* -> O Gemini lê o arquivo existente, diagnostica o problema e reescreve a versão corrigida.
- **Envio de Fotos e Capturas (Visão Multimodal)**:
  - Toque no ícone da **📷 câmera**: tire foto de um desenho de fase no papel, de uma tela de erro ou selecione sprites de referência. O Gemini analisará a imagem e criará os nós ou scripts correspondentes.
- **Explorador de Arquivos do Projeto (📁)**:
  - Toque no ícone de pasta na barra superior para ver todos os arquivos `.gd`, `.tscn` e recursos do seu jogo. Toque em qualquer um para ler o código no celular.
- **Sistema de Backups Automáticos**:
  - Antes de alterar qualquer arquivo existente, uma cópia de segurança com data e hora é gravada automaticamente na pasta oculta `.gemini_backups/`, garantindo que você nunca perca seu código anterior.

---

## 📦 Gerar arquivo APK a partir do PWA (Opcional)

Como este app é um **PWA (Progressive Web App)** completo com `manifest.json` e `Service Worker`, você pode transformá-lo em um arquivo `.apk` de duas formas práticas:

1. **Via PWABuilder (Recomendado - Sem instalar nada)**:
   - Se você colocar estes arquivos em uma hospedagem gratuita HTTPS (como GitHub Pages, Vercel ou Cloudflare Pages), basta colar a URL no site [PWABuilder](https://www.pwabuilder.com/).
   - O PWABuilder gera o pacote `.apk` pronto para download e instalação no Android com um clique.
2. **Via Bubblewrap CLI (Google)**:
   ```bash
   npm install -g @bubblewrap/cli
   bubblewrap init --manifest=manifest.json
   bubblewrap build
   ```
