drop extension if exists "pg_net";

revoke delete on table "public"."audit_record" from "anon";

revoke insert on table "public"."audit_record" from "anon";

revoke select on table "public"."audit_record" from "anon";

revoke update on table "public"."audit_record" from "anon";

revoke delete on table "public"."audit_record" from "authenticated";

revoke insert on table "public"."audit_record" from "authenticated";

revoke select on table "public"."audit_record" from "authenticated";

revoke update on table "public"."audit_record" from "authenticated";

revoke delete on table "public"."audit_record" from "service_role";

revoke insert on table "public"."audit_record" from "service_role";

revoke select on table "public"."audit_record" from "service_role";

revoke update on table "public"."audit_record" from "service_role";

revoke delete on table "public"."booking" from "anon";

revoke insert on table "public"."booking" from "anon";

revoke update on table "public"."booking" from "anon";

revoke delete on table "public"."booking" from "authenticated";

revoke insert on table "public"."booking" from "authenticated";

revoke update on table "public"."booking" from "authenticated";

revoke delete on table "public"."booking" from "service_role";

revoke insert on table "public"."booking" from "service_role";

revoke select on table "public"."booking" from "service_role";

revoke update on table "public"."booking" from "service_role";

revoke delete on table "public"."booking_slot" from "anon";

revoke insert on table "public"."booking_slot" from "anon";

revoke select on table "public"."booking_slot" from "anon";

revoke update on table "public"."booking_slot" from "anon";

revoke delete on table "public"."booking_slot" from "authenticated";

revoke insert on table "public"."booking_slot" from "authenticated";

revoke select on table "public"."booking_slot" from "authenticated";

revoke update on table "public"."booking_slot" from "authenticated";

revoke delete on table "public"."booking_slot" from "service_role";

revoke insert on table "public"."booking_slot" from "service_role";

revoke select on table "public"."booking_slot" from "service_role";

revoke update on table "public"."booking_slot" from "service_role";

revoke delete on table "public"."change_request" from "anon";

revoke insert on table "public"."change_request" from "anon";

revoke select on table "public"."change_request" from "anon";

revoke update on table "public"."change_request" from "anon";

revoke delete on table "public"."change_request" from "authenticated";

revoke insert on table "public"."change_request" from "authenticated";

revoke select on table "public"."change_request" from "authenticated";

revoke update on table "public"."change_request" from "authenticated";

revoke delete on table "public"."change_request" from "service_role";

revoke insert on table "public"."change_request" from "service_role";

revoke select on table "public"."change_request" from "service_role";

revoke update on table "public"."change_request" from "service_role";

revoke delete on table "public"."change_request_item" from "anon";

revoke insert on table "public"."change_request_item" from "anon";

revoke select on table "public"."change_request_item" from "anon";

revoke update on table "public"."change_request_item" from "anon";

revoke delete on table "public"."change_request_item" from "authenticated";

revoke insert on table "public"."change_request_item" from "authenticated";

revoke select on table "public"."change_request_item" from "authenticated";

revoke update on table "public"."change_request_item" from "authenticated";

revoke delete on table "public"."change_request_item" from "service_role";

revoke insert on table "public"."change_request_item" from "service_role";

revoke select on table "public"."change_request_item" from "service_role";

revoke update on table "public"."change_request_item" from "service_role";

revoke delete on table "public"."client_organisation" from "anon";

revoke insert on table "public"."client_organisation" from "anon";

revoke select on table "public"."client_organisation" from "anon";

revoke update on table "public"."client_organisation" from "anon";

revoke delete on table "public"."client_organisation" from "authenticated";

revoke insert on table "public"."client_organisation" from "authenticated";

revoke select on table "public"."client_organisation" from "authenticated";

revoke update on table "public"."client_organisation" from "authenticated";

revoke delete on table "public"."client_organisation" from "service_role";

revoke insert on table "public"."client_organisation" from "service_role";

revoke update on table "public"."client_organisation" from "service_role";

revoke delete on table "public"."equipment_item" from "anon";

revoke insert on table "public"."equipment_item" from "anon";

revoke select on table "public"."equipment_item" from "anon";

revoke update on table "public"."equipment_item" from "anon";

revoke delete on table "public"."equipment_item" from "authenticated";

revoke insert on table "public"."equipment_item" from "authenticated";

revoke select on table "public"."equipment_item" from "authenticated";

revoke update on table "public"."equipment_item" from "authenticated";

revoke delete on table "public"."equipment_item" from "service_role";

revoke insert on table "public"."equipment_item" from "service_role";

revoke select on table "public"."equipment_item" from "service_role";

revoke update on table "public"."equipment_item" from "service_role";

revoke delete on table "public"."equipment_reservation" from "anon";

revoke insert on table "public"."equipment_reservation" from "anon";

revoke select on table "public"."equipment_reservation" from "anon";

revoke update on table "public"."equipment_reservation" from "anon";

revoke delete on table "public"."equipment_reservation" from "authenticated";

revoke insert on table "public"."equipment_reservation" from "authenticated";

revoke select on table "public"."equipment_reservation" from "authenticated";

revoke update on table "public"."equipment_reservation" from "authenticated";

revoke delete on table "public"."equipment_reservation" from "service_role";

revoke insert on table "public"."equipment_reservation" from "service_role";

revoke select on table "public"."equipment_reservation" from "service_role";

revoke update on table "public"."equipment_reservation" from "service_role";

revoke delete on table "public"."equipment_reservation_line" from "anon";

revoke insert on table "public"."equipment_reservation_line" from "anon";

revoke select on table "public"."equipment_reservation_line" from "anon";

revoke update on table "public"."equipment_reservation_line" from "anon";

revoke delete on table "public"."equipment_reservation_line" from "authenticated";

revoke insert on table "public"."equipment_reservation_line" from "authenticated";

revoke select on table "public"."equipment_reservation_line" from "authenticated";

revoke update on table "public"."equipment_reservation_line" from "authenticated";

revoke delete on table "public"."equipment_reservation_line" from "service_role";

revoke insert on table "public"."equipment_reservation_line" from "service_role";

revoke select on table "public"."equipment_reservation_line" from "service_role";

revoke update on table "public"."equipment_reservation_line" from "service_role";

revoke delete on table "public"."event" from "anon";

revoke insert on table "public"."event" from "anon";

revoke update on table "public"."event" from "anon";

revoke delete on table "public"."event" from "authenticated";

revoke insert on table "public"."event" from "authenticated";

revoke update on table "public"."event" from "authenticated";

revoke delete on table "public"."event" from "service_role";

revoke insert on table "public"."event" from "service_role";

revoke select on table "public"."event" from "service_role";

revoke update on table "public"."event" from "service_role";

revoke delete on table "public"."event_comment" from "anon";

revoke insert on table "public"."event_comment" from "anon";

revoke select on table "public"."event_comment" from "anon";

revoke update on table "public"."event_comment" from "anon";

revoke delete on table "public"."event_comment" from "authenticated";

revoke insert on table "public"."event_comment" from "authenticated";

revoke select on table "public"."event_comment" from "authenticated";

revoke update on table "public"."event_comment" from "authenticated";

revoke delete on table "public"."event_comment" from "service_role";

revoke insert on table "public"."event_comment" from "service_role";

revoke select on table "public"."event_comment" from "service_role";

revoke update on table "public"."event_comment" from "service_role";

revoke delete on table "public"."event_essential_arrangement" from "anon";

revoke insert on table "public"."event_essential_arrangement" from "anon";

revoke select on table "public"."event_essential_arrangement" from "anon";

revoke update on table "public"."event_essential_arrangement" from "anon";

revoke delete on table "public"."event_essential_arrangement" from "authenticated";

revoke insert on table "public"."event_essential_arrangement" from "authenticated";

revoke select on table "public"."event_essential_arrangement" from "authenticated";

revoke update on table "public"."event_essential_arrangement" from "authenticated";

revoke delete on table "public"."event_essential_arrangement" from "service_role";

revoke insert on table "public"."event_essential_arrangement" from "service_role";

revoke select on table "public"."event_essential_arrangement" from "service_role";

revoke update on table "public"."event_essential_arrangement" from "service_role";

revoke delete on table "public"."event_request" from "anon";

revoke insert on table "public"."event_request" from "anon";

revoke select on table "public"."event_request" from "anon";

revoke update on table "public"."event_request" from "anon";

revoke delete on table "public"."event_request" from "authenticated";

revoke insert on table "public"."event_request" from "authenticated";

revoke select on table "public"."event_request" from "authenticated";

revoke update on table "public"."event_request" from "authenticated";

revoke delete on table "public"."event_request" from "service_role";

revoke insert on table "public"."event_request" from "service_role";

revoke select on table "public"."event_request" from "service_role";

revoke update on table "public"."event_request" from "service_role";

revoke delete on table "public"."notification" from "anon";

revoke insert on table "public"."notification" from "anon";

revoke select on table "public"."notification" from "anon";

revoke update on table "public"."notification" from "anon";

revoke delete on table "public"."notification" from "authenticated";

revoke insert on table "public"."notification" from "authenticated";

revoke select on table "public"."notification" from "authenticated";

revoke update on table "public"."notification" from "authenticated";

revoke delete on table "public"."notification" from "service_role";

revoke insert on table "public"."notification" from "service_role";

revoke select on table "public"."notification" from "service_role";

revoke update on table "public"."notification" from "service_role";

revoke delete on table "public"."registration" from "service_role";

revoke insert on table "public"."registration" from "service_role";

revoke select on table "public"."registration" from "service_role";

revoke update on table "public"."registration" from "service_role";

revoke delete on table "public"."role" from "anon";

revoke insert on table "public"."role" from "anon";

revoke select on table "public"."role" from "anon";

revoke update on table "public"."role" from "anon";

revoke delete on table "public"."role" from "authenticated";

revoke insert on table "public"."role" from "authenticated";

revoke select on table "public"."role" from "authenticated";

revoke update on table "public"."role" from "authenticated";

revoke delete on table "public"."role" from "service_role";

revoke insert on table "public"."role" from "service_role";

revoke update on table "public"."role" from "service_role";

revoke delete on table "public"."room_layout" from "anon";

revoke insert on table "public"."room_layout" from "anon";

revoke select on table "public"."room_layout" from "anon";

revoke update on table "public"."room_layout" from "anon";

revoke delete on table "public"."room_layout" from "authenticated";

revoke insert on table "public"."room_layout" from "authenticated";

revoke select on table "public"."room_layout" from "authenticated";

revoke update on table "public"."room_layout" from "authenticated";

revoke delete on table "public"."room_layout" from "service_role";

revoke insert on table "public"."room_layout" from "service_role";

revoke select on table "public"."room_layout" from "service_role";

revoke update on table "public"."room_layout" from "service_role";

revoke delete on table "public"."session" from "anon";

revoke insert on table "public"."session" from "anon";

revoke select on table "public"."session" from "anon";

revoke update on table "public"."session" from "anon";

revoke delete on table "public"."session" from "authenticated";

revoke insert on table "public"."session" from "authenticated";

revoke select on table "public"."session" from "authenticated";

revoke update on table "public"."session" from "authenticated";

revoke delete on table "public"."session" from "service_role";

revoke insert on table "public"."session" from "service_role";

revoke select on table "public"."session" from "service_role";

revoke update on table "public"."session" from "service_role";

revoke delete on table "public"."support_request" from "anon";

revoke insert on table "public"."support_request" from "anon";

revoke select on table "public"."support_request" from "anon";

revoke update on table "public"."support_request" from "anon";

revoke delete on table "public"."support_request" from "authenticated";

revoke insert on table "public"."support_request" from "authenticated";

revoke select on table "public"."support_request" from "authenticated";

revoke update on table "public"."support_request" from "authenticated";

revoke delete on table "public"."support_request" from "service_role";

revoke insert on table "public"."support_request" from "service_role";

revoke select on table "public"."support_request" from "service_role";

revoke update on table "public"."support_request" from "service_role";

revoke delete on table "public"."support_request_assignment" from "anon";

revoke insert on table "public"."support_request_assignment" from "anon";

revoke select on table "public"."support_request_assignment" from "anon";

revoke update on table "public"."support_request_assignment" from "anon";

revoke delete on table "public"."support_request_assignment" from "authenticated";

revoke insert on table "public"."support_request_assignment" from "authenticated";

revoke select on table "public"."support_request_assignment" from "authenticated";

revoke update on table "public"."support_request_assignment" from "authenticated";

revoke delete on table "public"."support_request_assignment" from "service_role";

revoke insert on table "public"."support_request_assignment" from "service_role";

revoke select on table "public"."support_request_assignment" from "service_role";

revoke update on table "public"."support_request_assignment" from "service_role";

revoke delete on table "public"."supporting_document" from "anon";

revoke insert on table "public"."supporting_document" from "anon";

revoke select on table "public"."supporting_document" from "anon";

revoke update on table "public"."supporting_document" from "anon";

revoke delete on table "public"."supporting_document" from "authenticated";

revoke insert on table "public"."supporting_document" from "authenticated";

revoke select on table "public"."supporting_document" from "authenticated";

revoke update on table "public"."supporting_document" from "authenticated";

revoke delete on table "public"."supporting_document" from "service_role";

revoke insert on table "public"."supporting_document" from "service_role";

revoke select on table "public"."supporting_document" from "service_role";

revoke update on table "public"."supporting_document" from "service_role";

revoke delete on table "public"."user_account" from "anon";

revoke insert on table "public"."user_account" from "anon";

revoke select on table "public"."user_account" from "anon";

revoke update on table "public"."user_account" from "anon";

revoke delete on table "public"."user_account" from "authenticated";

revoke insert on table "public"."user_account" from "authenticated";

revoke select on table "public"."user_account" from "authenticated";

revoke update on table "public"."user_account" from "authenticated";

revoke delete on table "public"."user_account" from "service_role";

revoke delete on table "public"."user_account_role" from "anon";

revoke insert on table "public"."user_account_role" from "anon";

revoke select on table "public"."user_account_role" from "anon";

revoke update on table "public"."user_account_role" from "anon";

revoke delete on table "public"."user_account_role" from "authenticated";

revoke insert on table "public"."user_account_role" from "authenticated";

revoke select on table "public"."user_account_role" from "authenticated";

revoke update on table "public"."user_account_role" from "authenticated";

revoke delete on table "public"."user_account_role" from "service_role";

revoke update on table "public"."user_account_role" from "service_role";

revoke delete on table "public"."venue" from "anon";

revoke insert on table "public"."venue" from "anon";

revoke update on table "public"."venue" from "anon";

revoke delete on table "public"."venue" from "authenticated";

revoke insert on table "public"."venue" from "authenticated";

revoke update on table "public"."venue" from "authenticated";

revoke delete on table "public"."venue" from "service_role";

revoke insert on table "public"."venue" from "service_role";

revoke select on table "public"."venue" from "service_role";

revoke update on table "public"."venue" from "service_role";

revoke delete on table "public"."venue_supported_layout" from "anon";

revoke insert on table "public"."venue_supported_layout" from "anon";

revoke select on table "public"."venue_supported_layout" from "anon";

revoke update on table "public"."venue_supported_layout" from "anon";

revoke delete on table "public"."venue_supported_layout" from "authenticated";

revoke insert on table "public"."venue_supported_layout" from "authenticated";

revoke select on table "public"."venue_supported_layout" from "authenticated";

revoke update on table "public"."venue_supported_layout" from "authenticated";

revoke delete on table "public"."venue_supported_layout" from "service_role";

revoke insert on table "public"."venue_supported_layout" from "service_role";

revoke select on table "public"."venue_supported_layout" from "service_role";

revoke update on table "public"."venue_supported_layout" from "service_role";

revoke delete on table "public"."waiting_list_entry" from "anon";

revoke insert on table "public"."waiting_list_entry" from "anon";

revoke select on table "public"."waiting_list_entry" from "anon";

revoke update on table "public"."waiting_list_entry" from "anon";

revoke delete on table "public"."waiting_list_entry" from "authenticated";

revoke insert on table "public"."waiting_list_entry" from "authenticated";

revoke select on table "public"."waiting_list_entry" from "authenticated";

revoke update on table "public"."waiting_list_entry" from "authenticated";

revoke delete on table "public"."waiting_list_entry" from "service_role";

revoke insert on table "public"."waiting_list_entry" from "service_role";

revoke select on table "public"."waiting_list_entry" from "service_role";

revoke update on table "public"."waiting_list_entry" from "service_role";

alter table "public"."event" drop constraint "event_status_chk";

alter table "public"."event" alter column "event_id" set generated by default;

alter table "public"."event" alter column "status" set default '''''''Planning''''::text'::text;

alter table "public"."event" add constraint "event_status_check" CHECK ((status = ANY (ARRAY['Planning'::text, 'Confirmed'::text, 'Blocked'::text, 'Completed'::text, 'Cancelled'::text, 'Returned'::text]))) not valid;

alter table "public"."event" validate constraint "event_status_check";


