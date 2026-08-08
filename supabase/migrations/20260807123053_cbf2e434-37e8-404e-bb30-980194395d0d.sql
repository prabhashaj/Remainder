CREATE POLICY "own materials read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'materials' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own materials insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'materials' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own materials update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'materials' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own materials delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'materials' AND (storage.foldername(name))[1] = auth.uid()::text);