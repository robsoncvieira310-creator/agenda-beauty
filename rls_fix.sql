-- remover todas policies
drop policy if exists on profiles;

-- recriar simples
create policy "Users can view own profile"
on profiles
for select
using (auth.uid() = id);
