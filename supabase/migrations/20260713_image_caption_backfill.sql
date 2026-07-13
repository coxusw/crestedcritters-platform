update public.isopedia_species_images image
set caption = left(species.common_name, 180),
    updated_at = now()
from public.isopedia_species species
where image.species_id = species.id
  and coalesce(btrim(image.caption), '') = ''
  and coalesce(btrim(species.common_name), '') <> '';

with community_caption_source as (
  select distinct on (image.id)
    image.id,
    left(
      coalesce(
        nullif(btrim(species.common_name), ''),
        nullif(btrim(discussion.title), ''),
        nullif(btrim(reply_discussion.title), ''),
        'Community image'
      ),
      180
    ) as caption
  from public.community_images image
  left join public.community_discussions discussion
    on discussion.id = image.discussion_id
  left join public.community_replies reply
    on reply.id = image.reply_id
  left join public.community_discussions reply_discussion
    on reply_discussion.id = reply.discussion_id
  left join public.community_discussion_species discussion_species
    on discussion_species.discussion_id = coalesce(image.discussion_id, reply.discussion_id)
  left join public.isopedia_species species
    on species.id = discussion_species.species_id
  where coalesce(btrim(image.caption), '') = ''
  order by image.id, species.common_name nulls last, discussion.title nulls last, reply_discussion.title nulls last
)
update public.community_images image
set caption = community_caption_source.caption
from community_caption_source
where image.id = community_caption_source.id;

update public.isopedia_guide_images image
set caption = left(guide.title, 180)
from public.isopedia_guides guide
where image.guide_id = guide.id
  and coalesce(btrim(image.caption), '') = ''
  and coalesce(btrim(guide.title), '') <> '';
