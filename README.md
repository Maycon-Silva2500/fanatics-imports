# ⚽ FANATICS IMPORTS — E-commerce & Painel Administrativo

Sistema completo de loja virtual esportiva, gerenciamento de pedidos, integração de pagamentos (PIX e Cartão), notificações automáticas via WhatsApp Business API e painel administrativo completo.

- **Loja:** Fanatics Imports
- **Instagram Oficial:** [@Fanatics.imports_ofc](https://instagram.com/Fanatics.imports_ofc)
- **Identidade Visual:** Preto (`#0A0A0A`), Verde (`#00E676`) e Branco (`#FFFFFF`)

---

## 🚀 Tecnologias Utilizadas

- **Backend:** Node.js + Express.js (API REST)
- **Frontend:** HTML5, CSS3 moderno (Responsivo) e JavaScript Vanilla (ES6+)
- **Banco de Dados:** SQLite (Ambiente Local) com arquitetura preparada para PostgreSQL / Supabase
- **Pagamentos:** Mercado Pago (PIX QR Code/Copia e Cola + Cartão + Webhooks)
- **Notificações:** WhatsApp Business Platform (Cloud API Oficial) + Log Local de Testes
- **Segurança:** Helmet, Express Rate Limit, Bcrypt (Hash de senhas), JWT e Variáveis de Ambiente

---

## 📂 Arquitetura do Projeto

```text
fanatics-imports/
├── admin/          # Interface do Painel Administrativo protegido
├── database/       # Banco de dados SQLite e backups locais
├── public/         # Loja Virtual pública, checkout e rastreio de pedidos
├── src/            # Servidor Node.js, rotas API, middlewares e serviços
├── .env.example    # Modelo de variáveis de ambiente
├── .gitignore      # Proteção de credenciais e arquivos locais
├── INICIAR.bat     # Inicializador rápido para Windows
└── package.json    # Dependências do projeto