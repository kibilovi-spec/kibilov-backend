function generateSeoDescription(product, category, compatibility) {
  const parts = [];

  if (product.brand && product.brand !== 'Generic') {
    parts.push(`${product.nameKa} ${product.brand}`);
  } else {
    parts.push(product.nameKa);
  }

  if (category?.name_ka) {
    parts.push(`(${category.name_ka})`);
  }

  if (compatibility?.length) {
    const makes = [...new Set(compatibility.map(c => c.manufacturer_name))].slice(0, 5);
    parts.push(`- თავსებადია: ${makes.join(', ')}`);
  }

  if (product.oem) {
    parts.push(`OEM: ${product.oem}`);
  }

  parts.push('| იყიდე ონლაინ kibilov.ge | მიტანა რუსთავი, თბილისი');
  return parts.join(' ');
}

function generateMetaTitle(product, category) {
  const brand = product.brand && product.brand !== 'Generic' ? ` ${product.brand}` : '';
  const cat = category?.name_ka ? ` - ${category.name_ka}` : '';
  return `${product.nameKa}${brand}${cat} | kibilov.ge`;
}

module.exports = { generateSeoDescription, generateMetaTitle };
