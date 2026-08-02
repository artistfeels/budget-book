-- Data fix first, so the constraint rewrite below never rejects an existing row.
update transactions set flow_type = 'neutral' where flow_type = 'saving';
update transactions set flow_type_override = 'neutral' where flow_type_override = 'saving';
update classification_rules set flow_type = 'neutral' where flow_type = 'saving';

alter table transactions drop constraint if exists transactions_flow_type_check;
alter table transactions add constraint transactions_flow_type_check
  check (flow_type in ('income','spending','neutral'));

alter table transactions drop constraint if exists transactions_flow_type_override_check;
alter table transactions add constraint transactions_flow_type_override_check
  check (flow_type_override in ('spending','neutral'));

alter table classification_rules drop constraint if exists classification_rules_flow_type_check;
alter table classification_rules add constraint classification_rules_flow_type_check
  check (flow_type in ('spending','neutral'));
