-- 00_init.sql
-- Script Inicial do Banco de Dados: CRM Multi-Tenant

-- Extensões necessárias
create extension if not exists "uuid-ossp";

-- 1. Tabela de Tenants (Lojas/Empresas)
create table tenants (
    id uuid default uuid_generate_v4() primary key,
    name varchar(255) not null,
    business_context text, -- EX: "Boutique de Carnes Alpha Bull. Vende cortes premium (Wagyu, Angus)..."
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS
alter table tenants enable row level security;



-- 2. Tabela de Perfis de Usuários (Vendedores/Gerentes)
create table user_profiles (
    id uuid references auth.users not null primary key,
    tenant_id uuid references tenants(id) not null,
    name varchar(255) not null,
    role varchar(50) not null check (role in ('admin', 'vendedor')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table user_profiles enable row level security;

-- Política de RLS: O usuário só vê perfis do mesmo tenant
create policy "Users can view profiles in same tenant" on user_profiles
    for select using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));

-- 3. Tabela de Clientes (Leads e Compradores)
create table clients (
    id uuid default uuid_generate_v4() primary key,
    tenant_id uuid references tenants(id) not null,
    name varchar(255) not null,
    phone varchar(20),
    email varchar(255),
    bling_id varchar(100), -- ID do cliente no ERP Bling
    lead_score integer default 0, -- Nota de propensão de compra (0-100)
    cashback_balance decimal(10,2) default 0.00,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table clients enable row level security;
create policy "Users can access clients of their tenant" on clients
    for all using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));

-- 4. Kanban Boards (Quadros de Vendas)
create table kanban_columns (
    id uuid default uuid_generate_v4() primary key,
    tenant_id uuid references tenants(id) not null,
    title varchar(100) not null,
    position_order integer not null,
    is_system boolean default false -- Ex: "Ganho", "Perdido" não podem ser deletados
);

alter table kanban_columns enable row level security;
create policy "Users can access kanban columns of their tenant" on kanban_columns
    for all using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));

-- 5. Cards do Kanban (Negociações)
create table deals (
    id uuid default uuid_generate_v4() primary key,
    tenant_id uuid references tenants(id) not null,
    client_id uuid references clients(id) not null,
    column_id uuid references kanban_columns(id) not null,
    assigned_to uuid references user_profiles(id),
    title varchar(255) not null,
    value decimal(10,2) default 0.00,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table deals enable row level security;
create policy "Users can access deals of their tenant" on deals
    for all using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));

-- Índices de performance
create index idx_clients_tenant on clients(tenant_id);
create index idx_deals_tenant on deals(tenant_id);
create index idx_user_profiles_tenant on user_profiles(tenant_id);

-- 6. Tabela de Credenciais ERP (Bling OAuth 2.0)
create table bling_credentials (
    tenant_id uuid references tenants(id) primary key,
    access_token text not null,
    refresh_token text not null,
    expires_at timestamp with time zone not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table bling_credentials enable row level security;
-- Política: Sistema pode ler/escrever livremente, mas vamos proteger o acesso público.
create policy "Users can access bling creds of their tenant" on bling_credentials
    for all using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
