update public.permit_species
set
  scientific_name = updates.scientific_name,
  morph_name = updates.morph_name,
  taxonomy_notes = updates.taxonomy_notes,
  intended_use = 'Contained vivarium/terrarium cleanup crew and pets; not for environmental release or agricultural release.',
  updated_at = now()
from (
  values
    ('dairy-cows', 'Porcellio laevis', 'Dairy Cow', 'Use Porcellio laevis "Dairy Cow" unless APHIS requests a different accepted name.'),
    ('powder-orange', 'Porcellionides pruinosus', 'Powder Orange', 'Use Porcellionides pruinosus "Powder Orange" / "Orange" unless APHIS requests a different accepted name.'),
    ('gestroi', 'Armadillidium gestroi', null, 'Use Armadillidium gestroi unless APHIS requests a different accepted name.'),
    ('yellow-zebra', 'Armadillidium maculatum', 'Yellow Zebra', 'Commonly treated as an Armadillidium maculatum morph; confirm the exact colony label before filing.'),
    ('orange-cream', 'Porcellionides pruinosus', 'Orange Cream', 'Commonly treated in the hobby as Porcellionides pruinosus "Orange Cream"; confirm the colony label before filing.'),
    ('oreo-crumble', 'Porcellionides pruinosus', 'Oreo Crumble', 'Commonly treated in the hobby as Porcellionides pruinosus "Oreo Crumble"; confirm the colony label before filing.'),
    ('pineapple-spikey', 'Cristarmadillidium muricatum', 'Spikey Pineapple', 'Commonly listed as Cristarmadillidium muricatum "Spikey Pineapple" or "Crystal Pineapple"; confirm the colony label before filing.'),
    ('high-white-zebra', 'Armadillidium maculatum', 'High White Zebra', 'Commonly treated as an Armadillidium maculatum morph; confirm the exact colony label before filing.'),
    ('red-panda', 'Cubaris sp.', 'Red Panda', 'Trade name is commonly listed as Cubaris sp. "Red Panda"; species-level identification appears unresolved, so confirm acceptability before filing.'),
    ('rubber-ducky', 'Cubaris sp.', 'Rubber Ducky', 'Trade name is commonly listed as Cubaris sp. "Rubber Ducky"; species-level identification appears unresolved, so confirm acceptability before filing.'),
    ('temporate-springtails', 'Folsomia candida', 'Temperate culture', 'Common temperate white springtail cultures are often Folsomia candida; confirm the actual culture identity before filing. Product slug keeps existing shop spelling.')
) as updates(shop_slug, scientific_name, morph_name, taxonomy_notes)
where public.permit_species.shop_slug = updates.shop_slug;
