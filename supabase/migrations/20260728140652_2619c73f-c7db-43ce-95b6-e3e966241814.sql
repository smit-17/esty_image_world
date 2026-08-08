CREATE POLICY "jewelry_images_all" ON storage.objects FOR ALL TO anon, authenticated
USING (bucket_id = 'jewelry-images') WITH CHECK (bucket_id = 'jewelry-images');