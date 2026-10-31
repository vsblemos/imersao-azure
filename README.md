# AzureShop — Imersão Arquiteto Azure Cloud & AI

Material da aplicação AzureShop para os laboratórios da Imersão Arquiteto Azure.

## Comece pelo workshop

Leia o [guia completo do workshop](docs/WORKSHOP.md). Ele reúne os pré-requisitos, a sequência dos laboratórios e as orientações de segurança e custo.

## Obter o projeto

- **[Download ZIP (não exige Git)](https://github.com/highexpert-tecnologia/azureshop/archive/refs/heads/main.zip):** baixe o projeto sem instalar Git.
- **Clone com Git:** `git clone https://github.com/highexpert-tecnologia/azureshop.git`

O caminho padrão do workshop usa o [Portal do Azure](https://portal.azure.com/) e o [Azure Cloud Shell](https://learn.microsoft.com/azure/cloud-shell/overview), reduzindo instalações locais. Você não precisa executar a aplicação localmente para acompanhar o Dia 1.

## Conteúdo do repositório

- `docs/`: workshop, arquitetura e diagramas sanitizados.
- `public/` e `src/`: frontend e API da AzureShop.
- `infra/terraform/`: infraestrutura didática em Terraform e `terraform.tfvars.example`.
- `infra/k8s/`, `infra/sql/` e `infra/vm/`: manifestos, esquema de dados e material da etapa de VM.
- `test/`: testes automatizados da aplicação.

## Configuração segura

Use `.env.example` e `infra/terraform/terraform.tfvars.example` apenas como modelos. Para Terraform, crie uma cópia local de `terraform.tfvars.example` chamada `terraform.tfvars`, informe somente valores aprovados e nunca versione esse arquivo.

Não publique nem compartilhe `.env`, `terraform.tfvars`, estados Terraform, chaves, tokens, senhas, connection strings, bancos locais ou arquivos de segredo do Kubernetes. Revise custos, permissões e região com o instrutor antes de criar recursos Azure.

No modelo oficial do workshop, o Dia 1 cria RG, VNet, App Service, SQL, Private Endpoint e DNS pelo Portal. O Terraform do Dia 2 consulta esses recursos como dados e cria somente ACR, AKS e a conectividade nova em duas fases. Consulte [Bloqueios conhecidos e como resolver](docs/WORKSHOP.md#bloqueios-conhecidos-e-como-resolver) antes de executar um plano.

Consulte também a [arquitetura de referência](docs/ARCHITECTURE.md).

## Azure App Service (Linux)

- **Runtime:** Node.js 22 ou posterior, conforme `engines.node` do `package.json`.
- **Início:** `npm start` (`node src/server.js`); no contêiner, o `CMD` executa o mesmo arquivo.
- **Porta:** a aplicação escuta em `PORT` (padrão `3000`). Na publicação por código, use o `PORT` fornecido pela plataforma. No contêiner, configure `WEBSITES_PORT=3000` ou a porta de destino equivalente.
- **Health check:** configure o caminho `/api/health`; ele retorna `200` com o banco disponível e `503` em falha.
- **Configuração:** use App Settings com `APP_ENV=production`, `NODE_ENV=production`, `DB_PROVIDER=sqlserver`, `AZURE_SQL_AUTH=managedIdentity`, `AZURE_SQL_SERVER` e `AZURE_SQL_DATABASE`. Valores inválidos de `DB_PROVIDER`, `AZURE_SQL_AUTH` ou `PORT` interrompem a inicialização sem expor o valor recebido.
- **Identidade e banco:** habilite a identidade gerenciada e conceda as permissões SQL necessárias, inclusive para os ajustes de esquema executados na inicialização. Prepare as tabelas-base antes do primeiro início.
- **Dados:** trocar `DB_PROVIDER` não migra dados existentes. SQLite local não é adequado para persistência durável nem para scale-out.
