Estrutura do Projeto

```text
finTrack/
├── backend/                  # Servidor API em Node.js com TypeScript
│   ├── src/
│   │   ├── services/         # Regras de negócio e integração Open Finance
│   │   ├── types/            # Tipagens e modelos de dados em TypeScript
│   │   └── server.ts         # Ponto de entrada e rotas Express
│   ├── package.json          # Dependências e scripts do backend
│   └── tsconfig.json         # Configurações do compilador TypeScript
├── frontend/                 # Interface do utilizador
│   ├── assets/               # Imagens e logótipos
│   ├── index.html            # Estrutura visual da aplicação
│   ├── script.js             # Lógica e interatividade do ecrã
│   └── style.css             # Folha de estilos e layout visual
├── .gitignore                # Ficheiros ignorados pelo Git
└── README.md                 # Documentação do projeto

Pré-requisitos
Ter o Node.js instalado no computador (versão 18 ou superior).

1.Iniciar o Backend
    - Abre o terminal e navega até a pasta backend:
    - cd backend
2.Instala as dependências do projeto:

    npm install
3. Inicia o servidor em modo de desenvolvimento:
    npm run dev

O servidor estará ativo e pronto para receber pedidos no endereço:
http://localhost:3000