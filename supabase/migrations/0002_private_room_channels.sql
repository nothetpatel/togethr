-- Togethr: private realtime channels for rooms.
-- Live positions and presence travel on a channel named `room:<room id>`.
-- The app joins it as a *private* channel, so Supabase checks these rules:
-- only members of that room can listen or send. Without them, anyone with
-- the public anon key who guessed a room id could listen in.

create policy room_members_can_listen
  on realtime.messages for select to authenticated
  using (
    realtime.topic() like 'room:%'
    and public.is_room_member(split_part(realtime.topic(), ':', 2)::uuid)
  );

create policy room_members_can_send
  on realtime.messages for insert to authenticated
  with check (
    realtime.topic() like 'room:%'
    and public.is_room_member(split_part(realtime.topic(), ':', 2)::uuid)
  );
