select action, count(*) from audit_record
 where entity_type = 'venue_unavailability' group by action;
select count(*) as blocks, count(lifted_at) as lifted from venue_unavailability;
